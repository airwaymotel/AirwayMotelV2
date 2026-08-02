import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Use z-ai-web-dev-sdk for AI Vision
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an ID card scanner. Extract all information from this US ID card (driver's license or state ID). Return ONLY valid JSON with these exact fields. If a field is not found, use an empty string.

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
- Return ONLY the JSON object, no additional text, no markdown, no explanation`,
            },
            {
              type: 'image_url',
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No response from vision model' }, { status: 500 });
    }

    console.log('[Scan-ID] Raw model response (first 500 chars):', content.substring(0, 500));

    // Try to parse the JSON from the response with multiple strategies
    let parsedData = null;
    let parseError = null;

    // Strategy 1: Direct parse (model returned clean JSON)
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      parseError = e;
    }

    // Strategy 2: Strip markdown code blocks and try again
    if (!parsedData) {
      const stripped = content
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      try {
        parsedData = JSON.parse(stripped);
      } catch {}
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
          const jsonStr = content.substring(firstBrace, lastBrace + 1);
          try {
            parsedData = JSON.parse(jsonStr);
          } catch {}
        }
      }
    }

    // Strategy 4: Greedy regex as last resort
    if (!parsedData) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch {}
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
