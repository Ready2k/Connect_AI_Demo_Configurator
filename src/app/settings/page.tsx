import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure AWS integration and global project options.</p>
      </div>
      <SettingsForm />
    </div>
  );
}
