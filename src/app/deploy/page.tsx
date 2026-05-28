import { DeploymentStepper } from "@/components/DeploymentStepper";

export default function DeployPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deploy</h1>
        <p className="text-sm text-gray-500 mt-1">Review the deployment plan and execute the configuration push to AWS.</p>
      </div>
      <DeploymentStepper />
    </div>
  );
}
