import React from 'react';
import {
  Card, CardContent, CardActions, Typography, Chip, IconButton,
  Box, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';

const priorityColors = { low: 'success', medium: 'warning', high: 'error' };

export default function TodoCard({ todo, onToggle, onEdit, onDelete, showActions = true }) {
  return (
    <Card elevation={2} sx={{
      borderLeft: `4px solid`,
      borderColor: `${priorityColors[todo.priority]}.main`,
      opacity: todo.isCompleted ? 0.75 : 1,
      transition: 'all 0.2s',
      '&:hover': { elevation: 4, transform: 'translateY(-1px)' }
    }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {showActions && (
            <Tooltip title={todo.isCompleted ? 'Mark incomplete' : 'Mark complete'}>
              <IconButton size="small" onClick={() => onToggle(todo)} sx={{ mt: -0.5 }}>
                {todo.isCompleted
                  ? <CheckCircleIcon color="success" />
                  : <RadioButtonUncheckedIcon color="disabled" />}
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}
              sx={{ textDecoration: todo.isCompleted ? 'line-through' : 'none' }}>
              {todo.title}
            </Typography>
            {todo.details && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {todo.details}
              </Typography>
            )}
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip label={todo.priority} size="small" color={priorityColors[todo.priority]} />
              {todo.dueDate && (
                <Chip label={`Due: ${todo.dueDate}`} size="small" variant="outlined" />
              )}
              {todo.isPublic
                ? <Chip icon={<PublicIcon />} label="Public" size="small" color="info" variant="outlined" />
                : <Chip icon={<LockIcon />} label="Private" size="small" variant="outlined" />}
            </Box>
          </Box>
        </Box>
      </CardContent>
      {showActions && (
        <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
          <IconButton size="small" onClick={() => onEdit(todo)} color="primary">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(todo.id)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </CardActions>
      )}
    </Card>
  );
}
