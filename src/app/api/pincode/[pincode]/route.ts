import { NextResponse } from 'next/server';
import https from 'https';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pincode: string }> }
) {
  const resolvedParams = await params;
  const pincode = resolvedParams.pincode;
  
  return new Promise<Response>((resolve) => {
    https.get(`https://api.postalpincode.in/pincode/${pincode}`, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(NextResponse.json(JSON.parse(data)));
        } catch (e) {
          resolve(NextResponse.json({ error: "Failed to parse response" }, { status: 500 }));
        }
      });
    }).on('error', (err) => {
      resolve(NextResponse.json({ error: "Failed to fetch from API" }, { status: 500 }));
    });
  });
}
