import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/lib/auth';

const GEMINI_MODEL = 'gemini-3.6-flash';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, 'check_in')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.startsWith('http')) {
      const imgRes = await fetch(imageBase64);
      if (!imgRes.ok) throw new Error('Failed to fetch image');
      const arrayBuffer = await imgRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
      mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    } else {
      const cleanBase64 = imageBase64.replace(/\n/g, '');
      const dataUriMatch = cleanBase64.match(/^data:([^;,]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        base64Data = dataUriMatch[2];
      }
    }

    const prompt = `You are an ID card scanner. Extract ALL readable information from this government-issued ID card.

Return ONLY valid JSON with these exact fields. If a field is not found, use empty string "".

{
  "firstName": "", "middleName": "", "lastName": "", "fullName": "",
  "dateOfBirth": "YYYY-MM-DD", "gender": "",
  "address": { "street": "", "city": "", "state": "", "zipCode": "" },
  "idNumber": "", "idType": "", "issuingState": "", "expirationDate": "", "issueDate": "",
  "eyeColor": "", "hairColor": "", "height": "", "weight": "",
  "veteran": false, "organDonor": false, "realId": false
}

Rules: Parse full name into first/middle/last. Convert all dates to YYYY-MM-DD. Return ONLY JSON.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      }
    );

    if (!geminiResponse.ok) {
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 });
    }

    const geminiData = await geminiResponse.json();
    const content = geminiData?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '').join('') || '';

    if (!content) {
      return NextResponse.json({ error: 'No response from AI service' }, { status: 500 });
    }

    const tryParse = (candidate: string) => {
      try { return JSON.parse(candidate); } catch {}
      try { return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')); } catch {}
      return null;
    };

    let parsedData = tryParse(content);

    if (!parsedData) {
      const stripped = content.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
      parsedData = tryParse(stripped);
    }

    if (!parsedData) {
      const firstBrace = content.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        let lastBrace = -1;
        for (let i = firstBrace; i < content.length; i++) {
          if (content[i] === '{') depth++;
          if (content[i] === '}') { depth--; if (depth === 0) { lastBrace = i; break; } }
        }
        if (lastBrace !== -1) parsedData = tryParse(content.substring(firstBrace, lastBrace + 1));
      }
    }

    if (!parsedData) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedData = tryParse(jsonMatch[0]);
    }

    if (!parsedData) {
      return NextResponse.json({ error: 'Failed to parse ID data. Please try again with a clearer photo.' }, { status: 422 });
    }

    const normalizedData = {
      firstName: parsedData.firstName || '', middleName: parsedData.middleName || '',
      lastName: parsedData.lastName || '', fullName: parsedData.fullName || '',
      dateOfBirth: parsedData.dateOfBirth || '', gender: parsedData.gender || '',
      address: { street: parsedData.address?.street || '', city: parsedData.address?.city || '', state: parsedData.address?.state || '', zipCode: parsedData.address?.zipCode || '' },
      idNumber: parsedData.idNumber || '', idType: parsedData.idType || 'Driver License',
      issuingState: parsedData.issuingState || '', expirationDate: parsedData.expirationDate || '',
      issueDate: parsedData.issueDate || '', eyeColor: parsedData.eyeColor || '',
      hairColor: parsedData.hairColor || '', height: parsedData.height || '',
      weight: parsedData.weight || '', veteran: parsedData.veteran === true,
      organDonor: parsedData.organDonor === true, realId: parsedData.realId === true,
    };

    return NextResponse.json({ data: normalizedData });
  } catch {
    return NextResponse.json({ error: 'Failed to scan ID. Please try again.' }, { status: 500 });
  }
}
