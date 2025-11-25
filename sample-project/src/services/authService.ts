import { validateEmail, validatePassword } from '../utils/validators';
import { sendWelcomeEmail } from '../utils/email';

export const registerUser = (email: string, pass: string) => {
  console.log('Registering user service...');
  
  // 1. Validate Email
  if (!validateEmail(email)) {
    throw new Error('Invalid email');
  }
  
  // 2. Validate Password
  if (!validatePassword(pass)) {
    throw new Error('Weak password');
  }

  const user = { id: 1, email };
  
  // 3. Send Email
  sendWelcomeEmail(email);
  
  return user;
};

export const loginUser = (email: string, pass: string) => {
  if (!validateEmail(email)) return null;
  return { token: 'abc-123' };
};
