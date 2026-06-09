'use client';

import { useState, useMemo } from 'react';
import type { Ticket } from '../types';

export function useFilters(tickets: Ticket[]) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    tickets.forEach(t => cats.add(t.category_name || 'Uncategorized'));
    return ['all', ...Array.from(cats)];
  }, [tickets]);

  const categoriesList = useMemo(() => categories.filter(c => c !== 'all'), [categories]);

  const filteredTickets = useMemo(() => {
    let data = tickets;
    if (categoryFilter !== 'all') data = data.filter(t => (t.category_name || 'Uncategorized') === categoryFilter);
    if (priorityFilter !== 'all') data = data.filter(t => t.priority === priorityFilter);
    if (statusFilter !== 'all') data = data.filter(t => t.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(t => t.title.toLowerCase().includes(q) || t.number.toString().includes(q));
    }
    return data;
  }, [tickets, categoryFilter, priorityFilter, statusFilter, searchQuery]);

  return {
    categoryFilter, setCategoryFilter,
    priorityFilter, setPriorityFilter,
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    categories,
    categoriesList,
    filteredTickets,
  };
}
