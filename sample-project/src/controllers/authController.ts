import { registerUser, loginUser } from '../services/authService';

export const handleRegister = (req: any, res: any) => {
  console.log('Register request received');
  const { email, password } = req.body;
  
  // Call service to register user
  const user = registerUser(email, password);
  
  res.json(user);
};

export const handleLogin = (req: any, res: any) => {
  const { email, password } = req.body;
  const token = loginUser(email, password);
  res.json(token);
};
