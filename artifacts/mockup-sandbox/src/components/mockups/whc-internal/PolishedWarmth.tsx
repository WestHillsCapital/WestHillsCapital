import React from "react";
import { Search, ChevronRight, LayoutDashboard, Calendar, FileText, Settings, Shield, Bell, User, LogOut, ExternalLink, Wand2 } from "lucide-react";

type ProspectStatus = "new" | "contacted" | "qualified" | "cancelled";

interface Prospect {
  id: string;
  name: string;
  email: string;
  phone: string;
  state: string;
  structure: string;
  scheduled: string;
  status: ProspectStatus;
  created: string;
}

const mockData: Prospect[] = [
  { id: "P-1042", name: "Robert MacMillan", email: "rmacmillan84@gmail.com", phone: "(415) 555-0198", state: "CA", structure: "IRA", scheduled: "Today, 2:00 PM", status: "new", created: "2h ago" },
  { id: "P-1041", name: "Sarah Jenkins", email: "sarah.j.invests@yahoo.com", phone: "(212) 555-3421", state: "NY", structure: "Direct", scheduled: "Tomorrow, 10:30 AM", status: "contacted", created: "5h ago" },
  { id: "P-1040", name: "William T. Harrison", email: "wtharrison.sr@outlook.com", phone: "(512) 555-8812", state: "TX", structure: "401k Rollover", scheduled: "Oct 24, 1:15 PM", status: "qualified", created: "1d ago" },
  { id: "P-1039", name: "Elena Rostova", email: "erostova.arch@gmail.com", phone: "(305) 555-4921", state: "FL", structure: "IRA", scheduled: "-", status: "contacted", created: "1d ago" },
  { id: "P-1038", name: "Michael Chen", email: "mchen.tech@protonmail.com", phone: "(206) 555-1102", state: "WA", structure: "Direct", scheduled: "-", status: "new", created: "2d ago" },
  { id: "P-1037", name: "David & Mary Smith", email: "dmsmith1965@att.net", phone: "(602) 555-3384", state: "AZ", structure: "Joint", scheduled: "Oct 25, 9:00 AM", status: "qualified", created: "2d ago" },
  { id: "P-1036", name: "James Reynolds", email: "jreynolds.consulting@gmail.com", phone: "(312) 555-7741", state: "IL", structure: "IRA", scheduled: "-", status: "cancelled", created: "3d ago" },
  { id: "P-1035", name: "Katherine Lewis", email: "klewis.estate@yahoo.com", phone: "(404) 555-9923", state: "FL", structure: "Trust", scheduled: "Oct 26, 3:30 PM", status: "qualified", created: "3d ago" },
  { id: "P-1034", name: "Thomas Wright", email: "twright88@gmail.com", phone: "(702) 555-4511", state: "NV", structure: "Direct", scheduled: "-", status: "contacted", created: "4d ago" },
  { id: "P-1033", name: "Patricia O'Connor", email: "patricia.oconnor@icloud.com", phone: "(617) 555-2290", state: "MA", structure: "IRA", scheduled: "Oct 27, 11:00 AM", status: "new", created: "4d ago" },
  { id: "P-1032", name: "Richard Barnes", email: "rbarnes.phd@university.edu", phone: "(804) 555-6632", state: "VA", structure: "401k Rollover", scheduled: "-", status: "cancelled", created: "5d ago" },
  { id: "P-1031", name: "Amanda Hughes", email: "ahughes.design@gmail.com", phone: "(503) 555-8177", state: "OR", structure: "Direct", scheduled: "-", status: "contacted", created: "5d ago" },
];

const statusStyles = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const statusLabels = {
  new: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  cancelled: "Cancelled",
};

export function PolishedWarmth() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#0F1C3F] relative">
      {/* Top Navigation */}
      <nav 
        className="h-14 bg-[#FAF8F4] border-b border-[#DDD5C4] flex items-center justify-between px-4"
        style={{ boxShadow: "0 2px 8px rgba(15,28,63,0.08)" }}
      >
        <div className="flex items-center space-x-8">
          <div className="flex items-center">
            <span className="font-serif text-[#C49A38] text-xl font-bold tracking-tight">WHC</span>
            <div className="w-px h-6 bg-[#DDD5C4] mx-4" />
            <span className="text-sm text-[#4A5B7A] font-medium tracking-wide uppercase">Internal</span>
          </div>
          
          <div className="flex space-x-1">
            {[
              { label: "Prospecting Pipeline", active: true },
              { label: "Scheduled Calls" },
              { label: "Deal Builder" },
              { label: "Content" },
              { label: "Docuplete" },
              { label: "Super Admin" },
              { label: "Settings" }
            ].map((link, i) => (
              <button 
                key={i}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  link.active 
                    ? "bg-[#C49A38]/20 text-[#C49A38] font-semibold" 
                    : "text-[#4A5B7A] hover:text-[#0F1C3F] font-medium"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <button className="text-sm text-[#4A5B7A] hover:text-[#0F1C3F] font-medium flex items-center">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Public site
          </button>
          <div className="flex items-center space-x-3 border-l border-[#DDD5C4] pl-6">
            <div className="w-8 h-8 rounded-full bg-[#0F1C3F] text-white flex items-center justify-center text-xs font-medium">
              JD
            </div>
            <button className="text-sm text-[#4A5B7A] hover:text-[#0F1C3F] font-medium flex items-center">
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-[#0F1C3F] tracking-tight">Prospecting Pipeline</h1>
          <p className="text-sm text-[#8A9BB8] mt-1 font-medium">24 prospects · leads and scheduled calls in one workflow</p>
        </div>
        
        <div className="w-full h-px bg-[#C49A38]/20 mb-6" />

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-[#DDD5C4] shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F0E8] border-b border-[#DDD5C4]">
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">ID</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">Prospect</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">Contact</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">State</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">Structure</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">Scheduled</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">Created</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#6B7A99] uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD5C4]/50">
                {mockData.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-[#FEF9F1] transition-colors group">
                    <td className="py-3 px-4 text-sm font-mono text-[#4A5B7A]">{prospect.id}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-bold text-[#0F1C3F]">{prospect.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-[#374560]">{prospect.email}</div>
                      <div className="text-xs text-[#8A9BB8] mt-0.5">{prospect.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#4A5B7A]">{prospect.state}</td>
                    <td className="py-3 px-4 text-sm text-[#4A5B7A]">{prospect.structure}</td>
                    <td className="py-3 px-4">
                      <div className={`text-sm ${prospect.scheduled !== "-" ? "text-[#0F1C3F] font-medium" : "text-[#8A9BB8]"}`}>
                        {prospect.scheduled}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusStyles[prospect.status]}`}>
                        {statusLabels[prospect.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#8A9BB8]">{prospect.created}</td>
                    <td className="py-3 px-4 text-right">
                      <button className="inline-flex items-center px-3 py-1.5 bg-[#C49A38]/10 hover:bg-[#C49A38]/20 text-[#C49A38] border border-[#C49A38]/30 rounded text-xs font-semibold transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        Open Deal
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Merlin Chat Button */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-[#0F1C3F] hover:bg-[#1a2b5c] text-[#C49A38] rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 border border-[#C49A38]/30 z-50">
        <Wand2 className="w-6 h-6" />
      </button>
    </div>
  );
}
