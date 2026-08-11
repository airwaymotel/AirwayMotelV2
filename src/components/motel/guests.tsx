'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Printer, Users, Clock, Repeat, Search, Receipt, Trash2, Pencil, Loader2, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMotelStore } from '@/lib/store';
import { toast } from 'sonner';
import AnimateOnScroll from '@/components/ui/animate-on-scroll';
import type { Guest } from '@/lib/types';

export default function Guests() {
   const router = useRouter();
   const guests = useMotelStore((s) => s.guests);
  const stays = useMotelStore((s) => s.stays);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);
  const deleteGuest = useMotelStore((s) => s.deleteGuest);
  const updateGuest = useMotelStore((s) => s.updateGuest);

  const [searchQuery, setSearchQuery] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('All Types');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '', idNumber: '', dateOfBirth: '', idType: '', idState: '' });
  const [saving, setSaving] = useState(false);

  // Build history data — deduplicated: only most recent stay per guest
  const historyData = useMemo(() => {
    const guestMap = new Map<string, typeof stays[0]>();
    const sortedStays = [...stays].sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
    for (const stay of sortedStays) {
      if (!guestMap.has(stay.guestId)) {
        guestMap.set(stay.guestId, stay);
      }
    }
    const dedupedStays = Array.from(guestMap.values());

    return dedupedStays.map((stay) => {
      const guest = guests.find((g) => g.id === stay.guestId);
      const room = rooms.find((r) => r.id === stay.roomId);
      const stayPayments = payments.filter((p) => p.stayId === stay.id);
      const totalPaid = stayPayments.reduce((sum, p) => sum + p.amount, 0);

      const start = new Date(stay.checkInDate);
      const end = new Date(stay.checkOutDate);
      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: guest?.idNumber || stay.guestId.substring(0, 8),
        guestId: guest?.id || stay.guestId,
        name: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown',
        phone: guest?.phone || '',
        email: guest?.email || '',
        room: room?.roomNumber || '---',
        dates: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        details: `${nights} Night${nights > 1 ? 's' : ''} • ${room?.type === '1-bed' ? '1-Bed King' : room?.type === '2-bed' ? '2-Bed Queen' : 'Standard'}`,
        roomType: room?.type || '',
        status: stay.status === 'checked_out' ? 'Completed' : stay.status === 'active' ? 'Active' : 'Cancelled',
        paid: `$${totalPaid.toFixed(2)}`,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        stayId: stay.id,
        hasCash: stayPayments.some(p => p.method === 'cash'),
      };
    });
  }, [stays, guests, rooms, payments]);

  const filteredData = useMemo(() => {
    return historyData.filter((guest) => {
      const receiptId = guest.stayId.substring(0, 8).toUpperCase();
      const matchesSearch =
        guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receiptId.includes(searchQuery.toUpperCase());
      const matchesRoom = roomTypeFilter === 'All Types' || guest.roomType === roomTypeFilter;
      return matchesSearch && matchesRoom;
    });
  }, [historyData, searchQuery, roomTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  useMemo(() => { setPage(1); }, [searchQuery, roomTypeFilter]);

  // Stats
  const uniqueGuests = new Set(stays.map((s) => s.guestId)).size;
  const avgStay = historyData.length > 0
    ? Math.round(historyData.reduce((sum, h) => {
        const nights = parseInt(h.details) || 1;
        return sum + nights;
      }, 0) / historyData.length)
    : '0';
  const repeatRate = (() => {
    const guestCounts = new Map<string, number>();
    stays.forEach((s) => guestCounts.set(s.guestId, (guestCounts.get(s.guestId) || 0) + 1));
    const repeatGuests = [...guestCounts.values()].filter((c) => c > 1).length;
    return uniqueGuests > 0 ? ((repeatGuests / uniqueGuests) * 100).toFixed(1) : '0';
  })();

  const handleExportCSV = () => {
    const headers = ['Receipt ID', 'Guest Name', 'ID', 'Room', 'Stay Period', 'Details', 'Room Type', 'Status', 'Total Paid'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        `"${row.stayId.substring(0, 8).toUpperCase()}","${row.name}","${row.id}","${row.room}","${row.dates}","${row.details}","${row.roomType}","${row.status}","${row.paid}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `guest_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyEmails = () => {
    const emails = filteredData.map((r) => r.email).filter(Boolean);
    if (emails.length === 0) {
      toast.info('No emails to copy');
      return;
    }
    navigator.clipboard.writeText(emails.join(', '));
    toast.success(`Copied ${emails.length} email${emails.length === 1 ? '' : 's'}`);
  };

  const handleDeleteClick = (guestId: string, guestName: string) => {
    setGuestToDelete({ id: guestId, name: guestName });
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!guestToDelete) return;
    setDeleting(true);
    try {
      await deleteGuest(guestToDelete.id);
      toast.success(`Guest "${guestToDelete.name}" and all associated records deleted`);
      setShowDeleteDialog(false);
      setGuestToDelete(null);
    } catch {
      toast.error('Failed to delete guest');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = (guest: Guest) => {
    setEditingGuest(guest);
    setEditForm({
      firstName: guest.firstName,
      lastName: guest.lastName,
      phone: guest.phone,
      email: guest.email,
      idNumber: guest.idNumber,
      dateOfBirth: guest.dateOfBirth || '',
      idType: guest.idType || '',
      idState: guest.idState || '',
    });
    setShowEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editingGuest) return;
    setSaving(true);
    try {
      updateGuest(editingGuest.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        email: editForm.email,
        idNumber: editForm.idNumber,
        dateOfBirth: editForm.dateOfBirth,
        idType: editForm.idType,
        idState: editForm.idState,
      });
      toast.success('Guest updated successfully');
      setShowEditDialog(false);
      setEditingGuest(null);
    } catch {
      toast.error('Failed to update guest');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Guest History</h2>
          <p className="text-muted-foreground mt-1">Search and review past guest records.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <AnimateOnScroll>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Unique Guests</p>
              <p className="text-xl font-bold">{uniqueGuests}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. Stay Duration</p>
              <p className="text-xl font-bold">{avgStay} Days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Repeat Guest Rate</p>
              <p className="text-xl font-bold">{repeatRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
      </AnimateOnScroll>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <label className="block text-[10px] text-muted-foreground uppercase font-semibold mb-1">Guest Search</label>
              <Search className="absolute left-2.5 top-[26px] text-muted-foreground w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                placeholder="Name, ID, Phone, or Receipt ID..."
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-[10px] text-muted-foreground uppercase font-semibold mb-1">Room Type</label>
              <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Types">All Types</SelectItem>
                  <SelectItem value="1-bed">1-Bed King</SelectItem>
                  <SelectItem value="2-bed">2-Bed Queen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 flex items-end">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setSearchQuery('');
                  setRoomTypeFilter('All Types');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <AnimateOnScroll delay={200}>
        <div id="print-area">
        <div className="mb-4 hidden print:block text-center">
          <h1 className="text-xl font-bold">Airway Motel - Guest History Report</h1>
          <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
        </div>
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-[10px]">User</TableHead>
                  <TableHead className="uppercase text-[10px]">
                    <div className="flex items-center gap-1.5">
                      Contact
                      <button onClick={handleCopyEmails} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Copy all emails">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className="uppercase text-[10px]">Room #</TableHead>
                  <TableHead className="uppercase text-[10px]">Stay Period</TableHead>
                  <TableHead className="uppercase text-[10px] text-center">Status</TableHead>
                  <TableHead className="uppercase text-[10px] text-right no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <TableRow
                    key={idx}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/guest/${row.guestId}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{row.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{row.email || '—'}</p>
                        <p className="text-[11px] text-muted-foreground">{row.phone || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">#{row.room}</TableCell>
                    <TableCell>
                      <p className="text-sm">{row.dates}</p>
                      <p className="text-[11px] text-muted-foreground">{row.details}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={row.status === 'Completed' ? 'secondary' : row.status === 'Active' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right no-print" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit Guest" onClick={() => {
                          const guest = guests.find((g) => g.id === row.guestId);
                          if (guest) handleEditClick(guest);
                        }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete Guest" onClick={() => handleDeleteClick(row.guestId, row.name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {row.hasCash && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10" 
                            title="Download Cash Receipt"
                            onClick={() => window.open(`/stay/${row.stayId}/invoice?download=true`, '_blank')}
                          >
                            <Receipt className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No records found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
          <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between no-print">
            <p className="text-xs text-muted-foreground">
              Showing {paginatedData.length} of {filteredData.length} record{filteredData.length === 1 ? '' : 's'}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
      </AnimateOnScroll>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Guest</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{guestToDelete?.name}</strong>? This will permanently remove all their records including stays and payments. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Guest Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">ID Number</Label>
                <Input value={editForm.idNumber} onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Date of Birth</Label>
                <Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">ID Type</Label>
                <Input value={editForm.idType} onChange={(e) => setEditForm({ ...editForm, idType: e.target.value })} placeholder="e.g. Driver's License" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">ID State</Label>
                <Input value={editForm.idState} onChange={(e) => setEditForm({ ...editForm, idState: e.target.value })} placeholder="e.g. CO" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
