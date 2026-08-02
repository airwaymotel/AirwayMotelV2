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
- Return ONLY the JSON object, no additional text`,
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

    // Try to parse the JSON from the response
    let parsedData;
    try {
      // The model might wrap the JSON in markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = JSON.parse(content);
      }
    } catch {
      return NextResponse.json({
        error: 'Failed to parse ID data',
        raw: content,
      }, { status: 422 });
    }

    return NextResponse.json({ data: parsedData });
  } catch (error) {
    console.error('Scan ID error:', error);
    return NextResponse.json(
      { error: 'Failed to scan ID. Please try again.' },
      { status: 500 }
    );
  }
}
