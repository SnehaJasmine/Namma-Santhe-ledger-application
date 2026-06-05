/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  ArrowUpRight, 
  ArrowDownLeft, 
  LayoutDashboard, 
  Users, 
  History,
  MessageCircle,
  X,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { storage } from './storage';
import { Customer, Transaction, TransactionType } from './types';
import { GoogleGenAI } from '@google/genai';

// Lazy initialization function for Gemini
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI(apiKey);
};

export default function App() {
  const [view, setView] = useState<'dashboard' | 'customer-detail' | 'new-tx' | 'add-customer' | 'daily-summary' | 'reminders' | 'info'>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Transaction Flow State
  const [txAmount, setTxAmount] = useState('0');
  const [txType, setTxType] = useState<TransactionType>('CREDIT');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCustomers(storage.getCustomers().sort((a, b) => b.lastActivity - a.lastActivity));
    setTransactions(storage.getTransactions());
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId), 
  [customers, selectedCustomerId]);

  const dailyStats = useMemo(() => storage.getDailyStats(), [transactions, customers]);

  const handleAddCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    if (name && phone) {
      storage.addCustomer(name, phone);
      loadData();
      setView('dashboard');
    }
  };

  const handleAddTransaction = () => {
    if (selectedCustomerId && Number(txAmount) > 0) {
      storage.addTransaction(selectedCustomerId, Number(txAmount), txType);
      loadData();
      setTxAmount('0');
      setView('dashboard');
    }
  };

  const generateAiSummary = async () => {
    const genAI = getGenAI();
    if (!genAI) {
      setAiSummary("Namaste! Your ledger is active. Set your Gemini API Key in Secrets to get smart insights!");
      return;
    }
    setIsSummarizing(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `
        You are an assistant for a small street vendor in India using an app called "Namma-Santhe Ledger".
        Here are today's stats:
        - Total Credit (Udari) given today: ₹${dailyStats.totalCredit}
        - Total Payments received today: ₹${dailyStats.totalPayment}
        - Overall Outstanding (money yet to be collected): ₹${dailyStats.outstanding}
        
        Provide a very brief (2-3 sentences), encouraging summary in English with a touch of local Kannada flavor (use words like "Saar", "Namaste", "Santhe"). 
        Mention how they are doing and one tip for collection. Keep it professional yet friendly.
      `;
      const result = await model.generateContent(prompt);
      setAiSummary(result.response.text());
    } catch (error) {
      console.error("AI Error:", error);
      setAiSummary("Namaste! You had a busy day at the Santhe. Keep track of your Udari and happy selling!");
    } finally {
      setIsSummarizing(false);
    }
  };

  const sendWhatsAppReminder = (customer: Customer) => {
    const message = `Namaste ${customer.name}, this is a friendly reminder from our Santhe stall regarding your pending dues of ₹${customer.balance}. Kindly clear it when you visit next. Thank you!`;
    const url = `https://wa.me/91${customer.phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const Keypad = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
    const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'];
    return (
      <div className="grid grid-cols-3 gap-2 mt-4">
        {buttons.map((btn) => (
          <button
            key={btn}
            onClick={() => {
              if (btn === 'DEL') {
                onChange(value.length > 1 ? value.slice(0, -1) : '0');
              } else if (btn === '.') {
                if (!value.includes('.')) onChange(value + '.');
              } else {
                onChange(value === '0' ? btn : value + btn);
              }
            }}
            className="keypad-btn h-16 rounded-xl bg-white border border-gray-100 shadow-sm active:bg-gray-50"
            id={`key-${btn}`}
          >
            {btn}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
      {/* Header */}
      <header className="p-6 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Namma-Santhe <span className="text-[var(--santhe-accent)]">Ledger</span></h1>
          <p className="text-xs text-slate-500 font-medium">{format(new Date(), 'EEEE, d MMMM')}</p>
        </div>
        <button 
          onClick={() => setView('info')}
          className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          id="nav-info"
          title="Project Info"
        >
          <Sparkles size={20} />
        </button>
      </header>

      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-[var(--santhe-danger)]">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Total Outstanding</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold mono-number">₹{dailyStats.outstanding}</span>
                    <TrendingUp size={12} className="text-red-500" />
                  </div>
                </div>
                <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-[var(--santhe-accent)]">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Cash Received</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold mono-number">₹{dailyStats.totalPayment}</span>
                    <TrendingDown size={12} className="text-green-500" />
                  </div>
                </div>
              </div>

              {/* AI Summary Section */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                    <Sparkles size={16} />
                    <span>Daily Santhe Insight</span>
                  </div>
                  <button 
                    onClick={generateAiSummary}
                    disabled={isSummarizing}
                    className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSummarizing ? 'Summarizing...' : aiSummary ? 'Refresh' : 'Get Insight'}
                  </button>
                </div>
                {aiSummary ? (
                  <p className="text-sm text-slate-600 leading-relaxed italic">"{aiSummary}"</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">Click to get an AI summary of your day...</p>
                )}
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setView('daily-summary')}
                  className="p-4 glass-card rounded-2xl bg-white border border-slate-100 flex flex-col items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <History size={24} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-600">Daily Summary</span>
                </button>
                <button 
                  onClick={() => setView('reminders')}
                  className="p-4 glass-card rounded-2xl bg-white border border-slate-100 flex flex-col items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <MessageCircle size={24} className="text-green-500" />
                  <span className="text-xs font-bold text-slate-600">Reminders</span>
                </button>
              </div>

              {/* Customer List Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Customers</h2>
                  <span className="text-xs text-slate-400 font-medium">{customers.length} total</span>
                </div>
                
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search name or phone..." 
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    id="customer-search"
                  />
                </div>

                <div className="space-y-2">
                  {filteredCustomers.map(customer => (
                    <motion.div
                      layout
                      key={customer.id}
                      className="group relative"
                    >
                      <button
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setView('customer-detail');
                        }}
                        className="w-full flex items-center justify-between p-4 glass-card rounded-xl bg-white hover:bg-slate-50 transition-colors"
                        id={`customer-${customer.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase">
                            {customer.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-slate-900">{customer.name}</p>
                            <p className="text-xs text-slate-400">{customer.phone}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <p className={`font-bold mono-number ${customer.balance > 0 ? 'text-[var(--santhe-danger)]' : 'text-slate-500'}`}>
                              ₹{customer.balance}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {format(customer.lastActivity, 'h:mm a')}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>
                      </button>
                      
                      {/* Quick Add Button - Step 1 of 2 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerId(customer.id);
                          setView('new-tx');
                        }}
                        className="absolute -right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform z-10 border-2 border-white"
                        title="Quick Add Transaction"
                      >
                        <Plus size={18} />
                      </button>
                    </motion.div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="mx-auto text-slate-200 mb-2" size={48} />
                      <p className="text-slate-400 text-sm">No customers found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'daily-summary' && (
            <motion.div
              key="daily-summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setView('dashboard')} className="p-2 bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-bold">Daily Summary</h2>
              </div>

              <div className="p-6 glass-card rounded-3xl bg-white space-y-6">
                <div className="text-center">
                  <p className="text-sm text-slate-400 mb-1">Today's Activity</p>
                  <h3 className="text-lg font-bold text-slate-900">{format(new Date(), 'EEEE, do MMMM')}</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-red-400">Total Udari (Credit)</p>
                      <p className="text-2xl font-bold text-red-600 mono-number">₹{dailyStats.totalCredit}</p>
                    </div>
                    <ArrowUpRight className="text-red-300" size={32} />
                  </div>
                  <div className="p-4 rounded-2xl bg-green-50 border border-green-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-green-400">Total Payments</p>
                      <p className="text-2xl font-bold text-green-600 mono-number">₹{dailyStats.totalPayment}</p>
                    </div>
                    <ArrowDownLeft className="text-green-300" size={32} />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-500">Net Flow</span>
                    <span className={`text-lg font-bold mono-number ${dailyStats.totalPayment - dailyStats.totalCredit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {dailyStats.totalPayment - dailyStats.totalCredit >= 0 ? '+' : ''}₹{dailyStats.totalPayment - dailyStats.totalCredit}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">Summary generated at {format(new Date(), 'h:mm a')}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                  <Sparkles size={16} />
                  <span className="text-xs font-bold uppercase">AI Analysis</span>
                </div>
                <p className="text-sm text-slate-600 italic">
                  {aiSummary || "No AI insight generated for today yet. Use the 'Get Insight' button on the home screen to analyze your business."}
                </p>
              </div>
            </motion.div>
          )}

          {view === 'reminders' && (
            <motion.div
              key="reminders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setView('dashboard')} className="p-2 bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-bold">WhatsApp Reminders</h2>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-500">Customers with pending dues are listed here. One tap to send a professional reminder.</p>
                
                {customers.filter(c => c.balance > 0).length === 0 ? (
                  <div className="p-12 text-center glass-card rounded-2xl bg-white">
                    <MessageCircle size={48} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-400 text-sm">All dues are clear! No reminders needed.</p>
                  </div>
                ) : (
                  customers.filter(c => c.balance > 0).map(customer => (
                    <div key={customer.id} className="p-4 glass-card rounded-xl bg-white flex justify-between items-center transition-all hover:border-[var(--santhe-accent)]">
                      <div>
                        <p className="font-bold text-slate-900">{customer.name}</p>
                        <p className="text-xs text-red-500 font-bold">Owes ₹{customer.balance}</p>
                      </div>
                      <button 
                        onClick={() => sendWhatsAppReminder(customer)}
                        className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-green-600"
                      >
                        <MessageCircle size={14} /> Send
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {view === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 pb-12"
            >
              <div className="flex items-center gap-3">
                <button onClick={() => setView('dashboard')} className="p-2 bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-bold">Namma-Santhe Project</h2>
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <TrendingUp size={16} className="text-[var(--santhe-accent)]" /> Advantages
                </h3>
                <div className="grid gap-3">
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-green-500">
                    <p className="font-bold text-sm text-slate-800">Financial Inclusion</p>
                    <p className="text-xs text-slate-500">Bridging the gap for unorganized vendors at weekly Santhes through digital bookkeeping.</p>
                  </div>
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-green-500">
                    <p className="font-bold text-sm text-slate-800">Bad Debt Reduction</p>
                    <p className="text-xs text-slate-500">By tracking "Udari" efficiently, vendors avoid forgetting small debts that add up to major losses.</p>
                  </div>
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-green-500">
                    <p className="font-bold text-sm text-slate-800">Speed (2-Step Process)</p>
                    <p className="text-xs text-slate-500">Designed for fast-paced markets. Selecting a customer and entering an amount takes less than 5 seconds.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <X size={16} className="text-red-500" /> Limitations
                </h3>
                <div className="grid gap-3">
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-red-500">
                    <p className="font-bold text-sm text-slate-800">Offline Storage</p>
                    <p className="text-xs text-slate-500">Currently data is stored only in the browser's local storage. Clearing browser data will reset the ledger.</p>
                  </div>
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-red-500">
                    <p className="font-bold text-sm text-slate-800">Single Device</p>
                    <p className="text-xs text-slate-500">Lack of cloud-sync means you cannot access the ledger from multiple phones simultaneously.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <Plus size={16} className="text-indigo-500" /> Future Enhancements
                </h3>
                <div className="grid gap-3">
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-indigo-500">
                    <p className="font-bold text-sm text-slate-800">Cloud Sync & Backup</p>
                    <p className="text-xs text-slate-500">Integration with Firebase or Supabase to ensure data persistence and multi-device support.</p>
                  </div>
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-indigo-500">
                    <p className="font-bold text-sm text-slate-800">Voice Entries</p>
                    <p className="text-xs text-slate-500">AI-powered voice recognition to record transactions hands-free while dealing with customers.</p>
                  </div>
                  <div className="p-4 glass-card rounded-2xl bg-white border-l-4 border-l-indigo-500">
                    <p className="font-bold text-sm text-slate-800">Multi-Language Support</p>
                    <p className="text-xs text-slate-500">Full localized interfaces in Kannada, Telugu, and Tamil for rural vendors.</p>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {view === 'customer-detail' && selectedCustomer && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="p-6 glass-card rounded-3xl bg-white text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold mx-auto border-2 border-white shadow-sm">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <p className="text-slate-500 flex items-center justify-center gap-1">
                    <Phone size={14} /> {selectedCustomer.phone}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setView('new-tx')}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> New Entry
                  </button>
                  <button 
                    onClick={() => sendWhatsAppReminder(selectedCustomer)}
                    className="w-14 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center shadow-lg shadow-green-100"
                  >
                    <MessageCircle size={22} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">History</h3>
                  <History size={16} className="text-slate-400" />
                </div>
                
                <div className="space-y-2">
                  {transactions
                    .filter(t => t.customerId === selectedCustomerId)
                    .map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-4 glass-card rounded-xl bg-white">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${tx.type === 'CREDIT' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {tx.type === 'CREDIT' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{tx.type === 'CREDIT' ? 'Gave Credit' : 'Payment Recv.'}</p>
                            <p className="text-[10px] text-slate-400">{format(tx.timestamp, 'd MMM, h:mm a')}</p>
                          </div>
                        </div>
                        <p className={`font-bold mono-number text-lg ${tx.type === 'CREDIT' ? 'text-red-500' : 'text-green-600'}`}>
                          {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'new-tx' && selectedCustomer && (
            <motion.div
              key="new-tx"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setView('customer-detail')} className="p-2 bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-bold">Entry for {selectedCustomer.name}</h2>
              </div>

              <div className="p-8 glass-card rounded-3xl bg-white text-center">
                <p className="text-sm text-slate-400 font-medium mb-2">Enter Amount</p>
                <div className="text-5xl font-bold mono-number text-slate-900 flex items-center justify-center">
                  <span className="text-2xl text-slate-300 mr-1">₹</span>
                  {txAmount}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setTxType('CREDIT')}
                  className={`py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center gap-1 ${txType === 'CREDIT' ? 'bg-red-50 border-red-500 text-red-600 scale-[1.02]' : 'bg-white border-slate-100 text-slate-400'}`}
                >
                  <ArrowUpRight size={24} />
                  Udari (Credit)
                </button>
                <button 
                  onClick={() => setTxType('PAYMENT')}
                  className={`py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center gap-1 ${txType === 'PAYMENT' ? 'bg-green-50 border-green-500 text-green-600 scale-[1.02]' : 'bg-white border-slate-100 text-slate-400'}`}
                >
                  <ArrowDownLeft size={24} />
                  Payment
                </button>
              </div>

              <Keypad value={txAmount} onChange={setTxAmount} />

              <button 
                onClick={handleAddTransaction}
                disabled={Number(txAmount) === 0}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all mt-4"
              >
                Save Transaction
              </button>
            </motion.div>
          )}

          {view === 'add-customer' && (
            <motion.div
              key="add-customer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <button onClick={() => setView('dashboard')} className="p-2 bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-bold">New Customer</h2>
              </div>

              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Name</label>
                  <input 
                    name="name"
                    required
                    type="text" 
                    placeholder="Enter customer name" 
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    id="new-customer-name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+91</span>
                    <input 
                      name="phone"
                      required
                      type="tel"
                      pattern="[0-9]{10}"
                      placeholder="10 digit number" 
                      className="w-full p-4 pl-14 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      id="new-customer-phone"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all mt-8"
                >
                  Create Profile
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Bar */}
      {view !== 'add-customer' && view !== 'new-tx' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 max-w-md mx-auto z-30 flex justify-around items-center">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          
          <button 
            onClick={() => setView('add-customer')}
            className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform -mt-10 border-4 border-white"
            id="btn-add-customer-fab"
          >
            <Plus size={24} />
          </button>

          <button 
            onClick={() => setView('reminders')}
            className={`flex flex-col items-center gap-1 transition-colors ${view === 'reminders' ? 'text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <MessageCircle size={20} />
            <span className="text-[10px] font-bold">Dues</span>
          </button>
        </div>
      )}
    </div>
  );
}
