/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'CREDIT' | 'PAYMENT';

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: TransactionType;
  timestamp: number;
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number; // Positive means they owe the vendor (Credit)
  lastActivity: number;
}

export interface DailyStats {
  totalCredit: number;
  totalPayment: number;
  outstanding: number;
}
