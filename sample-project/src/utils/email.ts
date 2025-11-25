export const sendWelcomeEmail = (email: string) => {
  console.log(`Sending welcome email to ${email}`);
  formatEmailTemplate(email);
  return true;
};

const formatEmailTemplate = (email: string) => {
    console.log('Formatting template');
    return `Hello ${email}!`;
}
