import React, { useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  Wand2, 
  LogOut,
  ArrowRight,
  User,
  LayoutDashboard,
  Calendar,
  Briefcase,
  FileText,
  FileSignature,
  Settings as SettingsIcon,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const MOCK_DATA = [
  { id: 'PR-8291', name: 'Robert Chen', email: 'robert.chen@example.com', phone: '(555) 293-1928', state: 'CA', structure: 'IRA LLC', scheduled: 'Today, 2:30 PM', status: 'new', created: 'Oct 12, 2023' },
  { id: 'PR-8290', name: 'Sarah Jenkins', email: 's.jenkins88@example.com', phone: '(555) 847-2910', state: 'TX', structure: 'Direct', scheduled: 'Tomorrow, 10:00 AM', status: 'contacted', created: 'Oct 12, 2023' },
  { id: 'PR-8289', name: 'Michael Thompson', email: 'mthompson.invest@example.com', phone: '(555) 392-0019', state: 'FL', structure: 'Solo 401k', scheduled: 'Unscheduled', status: 'qualified', created: 'Oct 11, 2023' },
  { id: 'PR-8288', name: 'Elena Rodriguez', email: 'elena.r@example.com', phone: '(555) 773-8291', state: 'NY', structure: 'IRA LLC', scheduled: 'Oct 15, 1:00 PM', status: 'new', created: 'Oct 11, 2023' },
  { id: 'PR-8287', name: 'David Wilson', email: 'dwilson1975@example.com', phone: '(555) 482-9932', state: 'CO', structure: 'Direct', scheduled: 'Unscheduled', status: 'cancelled', created: 'Oct 10, 2023' },
  { id: 'PR-8286', name: 'James & Mary Smith', email: 'jmsmith.family@example.com', phone: '(555) 201-8845', state: 'OH', structure: 'Joint', scheduled: 'Oct 16, 11:30 AM', status: 'contacted', created: 'Oct 10, 2023' },
  { id: 'PR-8285', name: 'William Davis', email: 'wdavis.corporate@example.com', phone: '(555) 993-2811', state: 'NV', structure: 'Corporate', scheduled: 'Unscheduled', status: 'new', created: 'Oct 09, 2023' },
  { id: 'PR-8284', name: 'Jennifer Martinez', email: 'jmartinez.phd@example.com', phone: '(555) 664-1029', state: 'AZ', structure: 'IRA LLC', scheduled: 'Oct 17, 3:00 PM', status: 'qualified', created: 'Oct 09, 2023' },
  { id: 'PR-8283', name: 'Richard Taylor', email: 'rtaylor.consulting@example.com', phone: '(555) 382-7741', state: 'WA', structure: 'Solo 401k', scheduled: 'Unscheduled', status: 'contacted', created: 'Oct 08, 2023' },
  { id: 'PR-8282', name: 'Susan Anderson', email: 'sanderson.retire@example.com', phone: '(555) 551-9302', state: 'OR', structure: 'Direct', scheduled: 'Oct 18, 9:00 AM', status: 'new', created: 'Oct 08, 2023' },
  { id: 'PR-8281', name: 'Joseph Thomas', email: 'jthomas.engineering@example.com', phone: '(555) 728-1194', state: 'UT', structure: 'IRA LLC', scheduled: 'Unscheduled', status: 'cancelled', created: 'Oct 07, 2023' },
  { id: 'PR-8280', name: 'Karen Jackson', email: 'kjackson.design@example.com', phone: '(555) 419-8837', state: 'GA', structure: 'Trust', scheduled: 'Oct 19, 2:15 PM', status: 'qualified', created: 'Oct 07, 2023' },
];

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'new': return 'bg-[#1e3a5f] text-[#93c5fd] hover:bg-[#1e3a5f]';
    case 'contacted': return 'bg-[#713f12] text-[#fde047] hover:bg-[#713f12]';
    case 'qualified': return 'bg-[#14532d] text-[#86efac] hover:bg-[#14532d]';
    case 'cancelled': return 'bg-[#7f1d1d] text-[#fca5a5] hover:bg-[#7f1d1d]';
    default: return 'bg-gray-800 text-gray-200';
  }
};

export function StructuredPrecision() {
  const [activeNav, setActiveNav] = useState('Prospecting Pipeline');

  const navItems = [
    { name: 'Prospecting Pipeline', icon: LayoutDashboard },
    { name: 'Scheduled Calls', icon: Calendar },
    { name: 'Deal Builder', icon: Briefcase },
    { name: 'Content', icon: FileText },
    { name: 'Docuplete', icon: FileSignature },
    { name: 'Super Admin', icon: ShieldAlert },
    { name: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen w-full bg-white text-[#0F1C3F] font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 bg-[#0F1C3F] text-[#8A9BB8] flex flex-col flex-shrink-0 z-10">
        <div className="p-6 pb-8 border-b border-white/5">
          <div className="font-serif text-3xl font-bold text-[#C49A38] tracking-tight mb-1">WHC</div>
          <div className="text-[10px] uppercase tracking-widest text-[#8A9BB8]/60 font-medium">Internal Portal</div>
        </div>
        
        <div className="flex-1 py-4 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeNav === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveNav(item.name)}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors text-left
                    ${isActive 
                      ? 'border-l-2 border-[#C49A38] bg-[#C49A38]/10 text-[#C49A38]' 
                      : 'border-l-2 border-transparent hover:text-white hover:bg-white/5'
                    }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? 'text-[#C49A38]' : 'text-[#8A9BB8]'}`} />
                  {item.name}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 space-y-4">
          <a href="#" className="flex items-center gap-2 text-xs text-[#8A9BB8] hover:text-white transition-colors px-2">
            <ArrowRight className="h-3 w-3" />
            Public site
          </a>
          <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 cursor-pointer transition-colors">
            <Avatar className="h-8 w-8 border border-white/10">
              <AvatarFallback className="bg-[#1a2d5a] text-[#8A9BB8] text-xs">AJ</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-white truncate">Alex J.</div>
              <div className="text-xs text-[#8A9BB8] flex items-center gap-1 hover:text-white transition-colors mt-0.5">
                <LogOut className="h-3 w-3" />
                Sign out
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        {/* Top bar */}
        <header className="h-20 px-8 flex items-center justify-between border-b border-[#C49A38]/20 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F1C3F] tracking-tight">{activeNav}</h1>
            <p className="text-sm text-[#8A9BB8] mt-1">24 prospects · leads and scheduled calls in one workflow</p>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto space-y-6">
            
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A9BB8]" />
                <Input 
                  placeholder="Search prospects..." 
                  className="pl-9 h-9 border-[#DDD5C4] focus-visible:ring-[#C49A38] text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 border-[#DDD5C4] text-[#4A5B7A] font-normal">
                      Filter by status <ChevronDown className="ml-2 h-4 w-4 text-[#8A9BB8]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>All Statuses</DropdownMenuItem>
                    <DropdownMenuItem>New</DropdownMenuItem>
                    <DropdownMenuItem>Contacted</DropdownMenuItem>
                    <DropdownMenuItem>Qualified</DropdownMenuItem>
                    <DropdownMenuItem>Cancelled</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button className="h-9 bg-[#0F1C3F] hover:bg-[#1a2d5a] text-white text-sm px-4">
                  Add Prospect
                </Button>
              </div>
            </div>

            {/* Data Table */}
            <div className="rounded-lg border border-[#DDD5C4] shadow-sm bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-[#F0EBE1] text-[#4A5B7A] tracking-wide">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-24">ID</th>
                      <th className="px-4 py-3 font-semibold min-w-[180px]">Name</th>
                      <th className="px-4 py-3 font-semibold min-w-[200px]">Email</th>
                      <th className="px-4 py-3 font-semibold w-36">Phone</th>
                      <th className="px-4 py-3 font-semibold w-20">State</th>
                      <th className="px-4 py-3 font-semibold w-28">Structure</th>
                      <th className="px-4 py-3 font-semibold w-40">Scheduled</th>
                      <th className="px-4 py-3 font-semibold w-32">Status</th>
                      <th className="px-4 py-3 font-semibold w-32">Created</th>
                      <th className="px-4 py-3 font-semibold text-right w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDD5C4]/50 text-[#374560]">
                    {MOCK_DATA.map((row, idx) => (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8F7F5]'}>
                        <td className="px-4 py-3.5 font-mono text-xs text-[#8A9BB8]">{row.id}</td>
                        <td className="px-4 py-3.5 font-semibold text-[#0F1C3F]">{row.name}</td>
                        <td className="px-4 py-3.5 truncate max-w-[200px]" title={row.email}>{row.email}</td>
                        <td className="px-4 py-3.5">{row.phone}</td>
                        <td className="px-4 py-3.5 text-center">{row.state}</td>
                        <td className="px-4 py-3.5">{row.structure}</td>
                        <td className="px-4 py-3.5 text-[#6B7A99] text-xs">{row.scheduled}</td>
                        <td className="px-4 py-3.5">
                          <Badge className={`font-normal capitalize ${getStatusStyles(row.status)} border-0 shadow-none`}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#8A9BB8]">{row.created}</td>
                        <td className="px-4 py-3.5 text-right">
                          <Button size="sm" className="h-7 bg-[#0F1C3F] hover:bg-[#1a2d5a] text-white text-xs px-3 py-0 rounded">
                            Open Deal
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
        
        {/* Merlin Chat Button */}
        <button className="absolute bottom-6 right-6 h-14 w-14 bg-[#C49A38] hover:bg-[#b0882e] rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 z-50">
          <Wand2 className="h-6 w-6" />
        </button>

      </div>
    </div>
  );
}
