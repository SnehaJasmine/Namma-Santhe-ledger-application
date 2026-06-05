/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Transaction, TransactionType } from './types';

const CUSTOMERS_KEY = 'santhe_ledger_customers';
const TRANSACTIONS_KEY = 'santhe_ledger_transactions';

export const storage = {
  getCustomers: (): Customer[] => {
    const data = localStorage.getItem(CUSTOMERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCustomers: (customers: Customer[]) => {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  },

  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveTransactions: (transactions: Transaction[]) => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  },

  addCustomer: (name: string, phone: string): Customer => {
    const customers = storage.getCustomers();
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name,
      phone,
      balance: 0,
      lastActivity: Date.now(),
    };
    storage.saveCustomers([...customers, newCustomer]);
    return newCustomer;
  },

  addTransaction: (customerId: string, amount: number, type: TransactionType, note?: string): Transaction => {
    const transactions = storage.getTransactions();
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      customerId,
      amount,
      type,
      timestamp: Date.now(),
      note,
    };
    storage.saveTransactions([newTransaction, ...transactions]);

    // Update customer balance
    const customers = storage.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);
    if (customerIndex !== -1) {
      const change = type === 'CREDIT' ? amount : -amount;
      customers[customerIndex].balance += change;
      customers[customerIndex].lastActivity = Date.now();
      storage.saveCustomers(customers);
    }

    return newTransaction;
  },

  getDailyStats: (date: Date = new Date()) => {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(date.setHours(23, 59, 59, 999)).getTime();
    
    const transactions = storage.getTransactions();
    const customers = storage.getCustomers();

    const dailyTransactions = transactions.filter(t => t.timestamp >= startOfDay && t.timestamp <= endOfDay);
    
    const totalCredit = dailyTransactions.filter(t => t.type === 'CREDIT').reduce((acc, t) => acc + t.amount, 0);
    const totalPayment = dailyTransactions.filter(t => t.type === 'PAYMENT').reduce((acc, t) => acc + t.amount, 0);
    const outstanding = customers.reduce((acc, c) => acc + c.balance, 0);

    return { totalCredit, totalPayment, outstanding };
  }
};
