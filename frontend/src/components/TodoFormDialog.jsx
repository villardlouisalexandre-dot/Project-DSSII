import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Select, MenuItem, FormControl,
  InputLabel, FormControlLabel, Switch, Box, Alert
} from '@mui/material';

const defaultForm = {
  title: '', details: '', priority: 'medium', dueDate: '', isPublic: false, isCompleted: false
};

export default function TodoFormDialog({ open, todo, onClose, onSave }) {
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (todo) {
      setForm({
        title: todo.title || '',
        details: todo.details || '',
        priority: todo.priority || 'medium',
        dueDate: todo.dueDate || '',
        isPublic: todo.isPublic || false,
        isCompleted: todo.isCompleted || false,
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [todo, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    setError('');
    try {
      await onSave(form, todo?.id);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.errors;
      if (detail) {
        setError(Object.values(detail).flat().join(', '));
      } else {
        setError(err.response?.data?.detail || 'An error occurred');
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{todo ? 'Edit Todo' : 'Create Todo'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Title" name="title" value={form.title}
            onChange={handleChange} required fullWidth
            inputProps={{ minLength: 3, maxLength: 100 }}
          />
          <TextField
            label="Details" name="details" value={form.details}
            onChange={handleChange} multiline rows={3} fullWidth
            inputProps={{ maxLength: 1000 }}
          />
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select name="priority" value={form.priority} onChange={handleChange} label="Priority">
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Due Date" name="dueDate" type="date" value={form.dueDate}
            onChange={handleChange} fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <FormControlLabel
            control={<Switch name="isPublic" checked={form.isPublic} onChange={handleChange} />}
            label="Make public"
          />
          {todo && (
            <FormControlLabel
              control={<Switch name="isCompleted" checked={form.isCompleted} onChange={handleChange} />}
              label="Completed"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          {todo ? 'Save Changes' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
