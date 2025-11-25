import express from 'express';
import { handleRegister, handleLogin } from './controllers/authController';

const app = express();
app.use(express.json());

// Start the registration flow
app.post('/register', handleRegister);

app.post('/login', handleLogin);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
