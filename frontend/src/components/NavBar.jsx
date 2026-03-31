import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" elevation={1}>
      <Toolbar>
        <ChecklistRtlIcon sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => navigate(user ? '/dashboard' : '/public')}>
          DSS2 Todo App
        </Typography>
        <Button color="inherit" onClick={() => navigate('/public')}
          sx={{ fontWeight: location.pathname === '/public' ? 700 : 400 }}>
          Public
        </Button>
        {user ? (
          <>
            <Button color="inherit" onClick={() => navigate('/dashboard')}
              sx={{ fontWeight: location.pathname === '/dashboard' ? 700 : 400 }}>
              My Todos
            </Button>
            <Button color="inherit" onClick={handleLogout}>
              Logout ({user.email})
            </Button>
          </>
        ) : (
          <>
            <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
            <Button color="inherit" variant="outlined" sx={{ ml: 1 }}
              onClick={() => navigate('/register')}>Register</Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
