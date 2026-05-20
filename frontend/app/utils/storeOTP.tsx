let storedOtp = "";
let otpExpiry = 0;

export function storeOtp(otp: string) {
    storedOtp = otp;
    otpExpiry = Date.now() + 5 * 60 * 1000; 
}

export function getOtp(): string {
    if (Date.now() > otpExpiry) {
        storedOtp = "";
        return "";
    }
    return storedOtp;
}

export function clearOtp() {
    storedOtp = "";
    otpExpiry = 0;
}