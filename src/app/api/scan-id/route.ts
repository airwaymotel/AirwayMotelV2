import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const ID_SCAN_PROMPT = `You are an ID card scanner. Extract all information from this US ID card (driver's license or state ID). Return ONLY valid JSON with these exact fields. If a field is not found, use an empty string.

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
  "idType": "Driver License or State ID or Passport",
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
- Parse the full name into separate first/middle/last name fields
- Date format must be YYYY-MM-DD
- If you see "IDENTIFICATION CARD" it's a State ID, not a Driver License
- Look for the state name or abbreviation to determine issuingState
- Check for veteran designation, organ donor, and REAL ID star
- Return ONLY the JSON object, no additional text, no markdown, no explanation`;

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Use Google Gemini API for vision
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Extract base64 data and mime type from data URL
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.startsWith('data:')) {
      const matches = imageBase64.match(/^data:(.+?);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const result = await model.generateContent([
      { text: ID_SCAN_PROMPT },
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const content = result.response.text();

    if (!content) {
      return NextResponse.json({ error: 'No response from vision model' }, { status: 500 });
    }

    console.log('[Scan-ID] Raw model response (first 500 chars):', content.substring(0, 500));

    // Try to parse the JSON from the response with multiple strategies
    let parsedData = null;

    // Strategy 1: Direct parse
    try {
      parsedData = JSON.parse(content);
    } catch {}

    // Strategy 2: Strip markdown code blocks
    if (!parsedData) {
      const stripped = content
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      try {
        parsedData = JSON.parse(stripped);
      } catch {}
    }

    // Strategy 3: Balanced brace matching
    if (!parsedData) {
      const firstBrace = content.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        let lastBrace = -1;
        for (let i = firstBrace; i < content.length; i++) {
          if (content[i] === '{') depth++;
          if (content[i] === '}') {
            depth--;
            if (depth === 0) { lastBrace = i; break; }
          }
        }
        if (lastBrace !== -1) {
          try {
            parsedData = JSON.parse(content.substring(firstBrace, lastBrace + 1));
          } catch {}
        }
      }
    }

    // Strategy 4: Greedy regex
    if (!parsedData) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsedData = JSON.parse(jsonMatch[0]); } catch {}
      }
    }

    if (!parsedData) {
      console.error('[Scan-ID] All JSON parsing strategies failed. Raw content:', content);
      return NextResponse.json({
        error: 'Failed to parse ID data. The AI could not extract structured information from this image. Please try again with a clearer photo.',
        raw: content.substring(0, 1000),
      }, { status: 422 });
    }

    // Normalize the data
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
