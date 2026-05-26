'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useStore();

  useEffect(() => {
    if (user?.role === 'user') {
      router.replace('/dashboard/portal');
    } else if (user) {
      router.replace('/dashboard/tickets');
    }
  }, [user, router]);

  return null;
}
