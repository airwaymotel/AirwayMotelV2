import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-1.5-flash';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Add it to your .env file.' },
        { status: 500 }
      );
    }

    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Parse data URI if present (e.g. "data:image/jpeg;base64,...") or fetch if it's a URL
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;
    
    if (imageBase64.startsWith('http')) {
      const imgRes = await fetch(imageBase64);
      if (!imgRes.ok) throw new Error('Failed to fetch image from URL');
      const arrayBuffer = await imgRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
      mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    } else {
      // Strip newlines just in case and match without the /s flag to fix TS error
      const cleanBase64 = imageBase64.replace(/\n/g, '');
      const dataUriMatch = cleanBase64.match(/^data:([^;,]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        base64Data = dataUriMatch[2];
      }
    }

    const prompt = `You are an ID card scanner. Extract ALL readable information from this government-issued ID card. It could be a US driver's license, US state ID, passport (US or foreign), national ID card from any country, military ID, permanent resident card, or any other official identification document.

Return ONLY valid JSON with these exact fields. If a field is not found on the document, use an empty string "" — never invent data.

{
  "firstName": "",
  "middleName": "",
  "lastName": "",
  "fullName": "",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "",
  "address": {
    "street": "",
    "city": "",
    "state": "",
    "zipCode": ""
  },
  "idNumber": "",
  "idType": "",
  "issuingState": "",
  "expirationDate": "",
  "issueDate": "",
  "eyeColor": "",
  "hairColor": "",
  "height": "",
  "weight": "",
  "veteran": false,
  "organDonor": false,
  "realId": false
}

Important rules:
- Parse the full name into separate first/middle/last name fields. Some IDs show the full name on one line — split it intelligently.
- Date format must be YYYY-MM-DD. Convert DD/MM/YYYY, DD-MMM-YYYY, or any other format to YYYY-MM-DD.
- For idType, use a descriptive label: "Driver License", "State ID", "Passport", "Military ID", "Permanent Resident Card", "National ID", or whatever the document actually is.
- For issuingState, use the country name if not a US state (e.g. "Mexico", "Canada", "Colombia").
- If a field like eyeColor, hairColor, height, weight, expirationDate, issueDate, veteran, organDonor, or realId is simply not printed on the document, leave it as empty string or false — that is fine.
- Some IDs have address in a single line — split it into street/city/state/zipCode as best you can.
- Return ONLY the JSON object, no additional text, no markdown, no explanation.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[Scan-ID] Gemini API error:', geminiResponse.status, errorText);
      return NextResponse.json(
        { error: 'The AI vision service returned an error. Please try again.', details: errorText, status: geminiResponse.status },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    const content =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('') || '';

    if (!content) {
      return NextResponse.json({ error: 'No response from vision model' }, { status: 500 });
    }

    console.log('[Scan-ID] Raw model response (first 500 chars):', content.substring(0, 500));

    // Try to parse the JSON from the response with multiple strategies
    const tryParse = (candidate: string) => {
      try {
        return JSON.parse(candidate);
      } catch {}
      // Models sometimes emit trailing commas (e.g. "false," before "}")
      // which strict JSON.parse rejects but lenient parsers accept.
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
      } catch {}
      return null;
    };

    let parsedData = null;

    // Strategy 1: Direct parse (model returned clean JSON)
    parsedData = tryParse(content);

    // Strategy 2: Strip markdown code blocks and try again
    if (!parsedData) {
      const stripped = content
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      parsedData = tryParse(stripped);
    }

    // Strategy 3: Find JSON object using balanced brace matching
    if (!parsedData) {
      const firstBrace = content.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        let lastBrace = -1;
        for (let i = firstBrace; i < content.length; i++) {
          if (content[i] === '{') depth++;
          if (content[i] === '}') {
            depth--;
            if (depth === 0) {
              lastBrace = i;
              break;
            }
          }
        }
        if (lastBrace !== -1) {
          parsedData = tryParse(content.substring(firstBrace, lastBrace + 1));
        }
      }
    }

    // Strategy 4: Greedy regex as last resort
    if (!parsedData) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = tryParse(jsonMatch[0]);
      }
    }

    if (!parsedData) {
      console.error('[Scan-ID] All JSON parsing strategies failed. Raw content:', content);
      return NextResponse.json({
        error: 'Failed to parse ID data. The AI could not extract structured information from this image. Please try again with a clearer photo.',
        raw: content.substring(0, 1000),
      }, { status: 422 });
    }

    // Ensure the parsed data has the expected structure
    const normalizedData = {
      firstName: parsedData.firstName || '',
      middleName: parsedData.middleName || '',
      lastName: parsedData.lastName || '',
      fullName: parsedData.fullName || '',
      dateOfBirth: parsedData.dateOfBirth || '',
      gender: parsedData.gender || '',
      address: {
        street: parsedData.address?.street || '',
        city: parsedData.address?.city || '',
        state: parsedData.address?.state || '',
        zipCode: parsedData.address?.zipCode || '',
      },
      idNumber: parsedData.idNumber || '',
      idType: parsedData.idType || 'Driver License',
      issuingState: parsedData.issuingState || '',
      expirationDate: parsedData.expirationDate || '',
      issueDate: parsedData.issueDate || '',
      eyeColor: parsedData.eyeColor || '',
      hairColor: parsedData.hairColor || '',
      height: parsedData.height || '',
      weight: parsedData.weight || '',
      veteran: parsedData.veteran === true,
      organDonor: parsedData.organDonor === true,
      realId: parsedData.realId === true,
    };

    console.log('[Scan-ID] Successfully parsed ID data:', normalizedData.fullName || 'No name found');

    return NextResponse.json({ data: normalizedData });
  } catch (error) {
    console.error('Scan ID error:', error);
    return NextResponse.json(
      { error: 'Failed to scan ID. Please try again.' },
      { status: 500 }
    );
  }
}