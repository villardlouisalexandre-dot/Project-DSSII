import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Alert, Link, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.email, form.password, form.displayName);
      // Auto-login after register
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(', '));
      } else {
        setError(err.response?.data?.detail || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom align="center">
          Create Account
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" mb={3}>
          Join to start managing your todos
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Display Name (optional)" name="displayName" value={form.displayName}
            onChange={handleChange} fullWidth />
          <TextField label="Email" name="email" type="email" value={form.email}
            onChange={handleChange} required fullWidth autoFocus />
          <TextField label="Password (min 6 chars)" name="password" type="password" value={form.password}
            onChange={handleChange} required fullWidth inputProps={{ minLength: 6 }} />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
          <Typography variant="body2" align="center">
            Already have an account?{' '}
            <Link href="/login" underline="hover">Sign in</Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
