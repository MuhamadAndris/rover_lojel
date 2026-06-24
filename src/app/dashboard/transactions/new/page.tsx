import TransactionForm from '../TransactionForm';

export default function NewTransactionPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <TransactionForm mode="new" />
    </div>
  );
}
