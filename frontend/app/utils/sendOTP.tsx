import Constants from 'expo-constants';
//EmailJS keys
const SERVICE_ID  = 'service_r9t4pun';
const TEMPLATE_ID = 'template_prq3vk7';
const PUBLIC_KEY  = '7LSMh6NjU9OH6APEj';
const PRIVATE_KEY = Constants.expoConfig?.extra?.apiUrl;

//Uses randomization to generate OTP
export function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(email: string, otp: string): Promise<void> {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id:      SERVICE_ID,
            template_id:     TEMPLATE_ID,
            user_id:         PUBLIC_KEY,
            accessToken:     PRIVATE_KEY,
            template_params: { email, otp },
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('EmailJS fetch error:', text);
        throw new Error(text);
    }

    console.log('EmailJS success');
}