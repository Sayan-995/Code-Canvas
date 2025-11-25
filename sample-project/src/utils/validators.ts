export const validateEmail = (email: string): boolean => {
  console.log('Validating email format');
  return email.includes('@');
};

export const validatePassword = (password: string): boolean => {
  console.log('Checking password strength');
  return password.length >= 8;
};
