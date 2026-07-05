import { describe, it, expect } from 'vitest';
import { categorize } from '../../../src/domain/accounting/TransactionCategorizer';

describe('TransactionCategorizer — categorize', () => {
  it('maps dining merchants to food', () => {
    expect(categorize('Zomato', '')).toBe('food');
    expect(categorize('Swiggy', '')).toBe('food');
    expect(categorize("Domino's Pizza", '')).toBe('food');
    expect(categorize('Starbucks Coffee', '')).toBe('food');
  });

  it('folds groceries into food', () => {
    expect(categorize('Blinkit', '')).toBe('food');
    expect(categorize('BigBasket', '')).toBe('food');
    expect(categorize('Zepto', '')).toBe('food');
    expect(categorize('DMart', '')).toBe('food');
  });

  it('maps ride-hailing and fuel to transport', () => {
    expect(categorize('Uber', '')).toBe('transport');
    expect(categorize('Ola Cabs', '')).toBe('transport');
    expect(categorize('HPCL Petrol Pump', '')).toBe('transport');
    expect(categorize('FASTag Recharge', '')).toBe('transport');
  });

  it('folds travel into transport', () => {
    expect(categorize('MakeMyTrip', '')).toBe('transport');
    expect(categorize('IRCTC', '')).toBe('transport');
    expect(categorize('IndiGo Airlines', '')).toBe('transport');
    expect(categorize('OYO Rooms', '')).toBe('transport');
  });

  it('maps streaming and cinema to entertainment', () => {
    expect(categorize('Netflix', '')).toBe('entertainment');
    expect(categorize('Spotify', '')).toBe('entertainment');
    expect(categorize('BookMyShow', '')).toBe('entertainment');
    expect(categorize('PVR Cinemas', '')).toBe('entertainment');
  });

  it('maps pharmacies and clinics to health', () => {
    expect(categorize('Apollo Pharmacy', '')).toBe('health');
    expect(categorize('PharmEasy', '')).toBe('health');
    expect(categorize('1mg', '')).toBe('health');
  });

  it('maps utilities and recharges to bills', () => {
    expect(categorize('Jio Recharge', '')).toBe('bills');
    expect(categorize('Airtel Postpaid', '')).toBe('bills');
    expect(categorize('Electricity Board', '')).toBe('bills');
  });

  it('maps retail merchants to shopping', () => {
    expect(categorize('Flipkart', '')).toBe('shopping');
    expect(categorize('Myntra', '')).toBe('shopping');
    expect(categorize('Croma', '')).toBe('shopping');
  });

  it('is case-insensitive', () => {
    expect(categorize('ZOMATO', '')).toBe('food');
    expect(categorize('uBeR', '')).toBe('transport');
  });

  it('matches against raw text when merchant is null', () => {
    expect(categorize(null, 'You paid ₹500 to Swiggy')).toBe('food');
    expect(categorize(null, 'UPI payment to NETFLIX.COM')).toBe('entertainment');
  });

  it('resolves collisions by rule order (most specific first)', () => {
    // "Amazon Prime Video" -> entertainment, not shopping ("amazon")
    expect(categorize('Amazon Prime Video', '')).toBe('entertainment');
    // Amazon Pay used to pay an electricity bill -> bills, not shopping
    expect(categorize('Amazon Pay', 'Electricity bill payment')).toBe('bills');
    // JioCinema -> entertainment, not bills ("jio")
    expect(categorize('JioCinema', '')).toBe('entertainment');
    // Plain Amazon -> shopping
    expect(categorize('Amazon', '')).toBe('shopping');
  });

  it('returns untagged for unknown merchants and empty input', () => {
    expect(categorize('Rahul Sharma', '')).toBe('untagged');
    expect(categorize(null, '')).toBe('untagged');
    expect(categorize('', '')).toBe('untagged');
    expect(categorize(null)).toBe('untagged');
  });
});
