import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Grid, Box, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Pagination, CircularProgress, Chip, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { getMyTodos, createTodo, updateTodo, deleteTodo, setCompletion } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import TodoCard from '../components/TodoCard';
import TodoFormDialog from '../components/TodoFormDialog';

export default function DashboardPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({
    search: '', priority: '', status: 'all', sortBy: 'createdAt', sortDir: 'desc'
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [feedback, setFeedback] = useState('');

  const fetchTodos = async (currentPage = page) => {
    setLoading(true);
    try {
      const params = { page: currentPage, pageSize: 9, ...filters };
      if (!params.priority) delete params.priority;
      if (!params.search) delete params.search;
      const res = await getMyTodos(params);
      setTodos(res.data.items);
      setTotalPages(res.data.totalPages);
      setTotalItems(res.data.totalItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTodos(1); setPage(1); }, [filters]);
  useEffect(() => { fetchTodos(page); }, [page]);

  const handleFilter = (e) => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
    setPage(1);
  };

  const handleSave = async (form, id) => {
    if (id) {
      await updateTodo(id, form);
      setFeedback('Todo updated!');
    } else {
      await createTodo(form);
      setFeedback('Todo created!');
    }
    setPage(1);
    await fetchTodos(1);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleToggle = async (todo) => {
    await setCompletion(todo.id, !todo.isCompleted);
    await fetchTodos(page);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this todo?')) return;
    await deleteTodo(id);
    setFeedback('Todo deleted');
    await fetchTodos(page);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleEdit = (todo) => {
    setEditingTodo(todo);
    setDialogOpen(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" fontWeight={700}>My Todos</Typography>
          <Chip label={`${totalItems} items`} size="small" />
          {user?.displayName && (
            <Typography variant="body2" color="text.secondary">— {user.displayName}</Typography>
          )}
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => { setEditingTodo(null); setDialogOpen(true); }}>
          New Todo
        </Button>
      </Box>

      {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField placeholder="Search..." name="search" value={filters.search}
          onChange={handleFilter} size="small" sx={{ flex: 1, minWidth: 200 }} />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Priority</InputLabel>
          <Select name="priority" value={filters.priority} onChange={handleFilter} label="Priority">
            <MenuItem value="">All</MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select name="status" value={filters.status} onChange={handleFilter} label="Status">
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort by</InputLabel>
          <Select name="sortBy" value={filters.sortBy} onChange={handleFilter} label="Sort by">
            <MenuItem value="createdAt">Created</MenuItem>
            <MenuItem value="dueDate">Due Date</MenuItem>
            <MenuItem value="priority">Priority</MenuItem>
            <MenuItem value="title">Title</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Dir</InputLabel>
          <Select name="sortDir" value={filters.sortDir} onChange={handleFilter} label="Dir">
            <MenuItem value="desc">Desc</MenuItem>
            <MenuItem value="asc">Asc</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : todos.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">No todos yet. Create your first one!</Typography>
          <Button variant="outlined" sx={{ mt: 2 }} startIcon={<AddIcon />}
            onClick={() => { setEditingTodo(null); setDialogOpen(true); }}>
            Create Todo
          </Button>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {todos.map(todo => (
              <Grid item xs={12} sm={6} md={4} key={todo.id}>
                <TodoCard
                  todo={todo}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </Grid>
            ))}
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        </>
      )}

      <TodoFormDialog
        open={dialogOpen}
        todo={editingTodo}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </Container>
  );
}
