import { Switch, Route, Redirect, Router as WouterRouter, Link } from "wouter";

import { DocsLayout } from "@/components/DocsLayout";

import WhatIsDocuplete from "@/pages/docs/getting-started/WhatIsDocuplete";
import QuickStart from "@/pages/docs/getting-started/QuickStart";
import Plans from "@/pages/docs/getting-started/Plans";

import Packages from "@/pages/docs/core-concepts/Packages";
import Sessions from "@/pages/docs/core-concepts/Sessions";
import Fields from "@/pages/docs/core-concepts/Fields";
import Mappings from "@/pages/docs/core-concepts/Mappings";

import Uploading from "@/pages/docs/building/Uploading";
import AcroFormReview from "@/pages/docs/building/AcroFormReview";
import BuildingFields from "@/pages/docs/building/BuildingFields";
import EsignFields from "@/pages/docs/building/EsignFields";
import Mapper from "@/pages/docs/building/Mapper";
import TextBoxes from "@/pages/docs/building/TextBoxes";
import Validation from "@/pages/docs/building/Validation";
import Configuration from "@/pages/docs/building/Configuration";
import HowToFirstPackage from "@/pages/docs/building/HowToFirstPackage";

import ConditionalSections from "@/pages/docs/patterns/ConditionalSections";
import UnmappedRoutingFields from "@/pages/docs/patterns/UnmappedRoutingFields";
import CheckboxOptions from "@/pages/docs/patterns/CheckboxOptions";

import FieldLibraryOverview from "@/pages/docs/field-library/FieldLibraryOverview";
import AddingLibraryFields from "@/pages/docs/field-library/AddingLibraryFields";
import EditingSharedFields from "@/pages/docs/field-library/EditingSharedFields";
import FieldLibraryBestPractices from "@/pages/docs/field-library/FieldLibraryBestPractices";

import SendingSessions from "@/pages/docs/sending/Sessions";
import Experience from "@/pages/docs/sending/Experience";
import EsignSending from "@/pages/docs/sending/Esign";
import Outcomes from "@/pages/docs/sending/Outcomes";
import Voiding from "@/pages/docs/sending/Voiding";

import BatchOverview from "@/pages/docs/batch/BatchOverview";
import BatchTemplate from "@/pages/docs/batch/BatchTemplate";
import BatchFilling from "@/pages/docs/batch/BatchFilling";
import BatchUploading from "@/pages/docs/batch/BatchUploading";
import BatchErrors from "@/pages/docs/batch/BatchErrors";

import Interviews from "@/pages/docs/dashboard/Interviews";
import BatchRuns from "@/pages/docs/dashboard/BatchRuns";

import WebhookSetup from "@/pages/docs/webhooks/WebhookSetup";
import WebhookPayload from "@/pages/docs/webhooks/WebhookPayload";
import WebhookSignature from "@/pages/docs/webhooks/WebhookSignature";
import WebhookRetries from "@/pages/docs/webhooks/WebhookRetries";
import WebhookLogs from "@/pages/docs/webhooks/WebhookLogs";
import WebhookRotating from "@/pages/docs/webhooks/WebhookRotating";

import GoogleDrive from "@/pages/docs/integrations/GoogleDrive";
import HubSpot from "@/pages/docs/integrations/HubSpot";

import Billing from "@/pages/docs/account/Billing";
import Branding from "@/pages/docs/account/Branding";
import Channels from "@/pages/docs/account/Channels";
import ApiKeys from "@/pages/docs/account/ApiKeys";

import DeveloperAuthentication from "@/pages/docs/developer/Authentication";
import Sdk from "@/pages/docs/developer/Sdk";
import PythonSdk from "@/pages/docs/developer/PythonSdk";
import BulkSessions from "@/pages/docs/developer/BulkSessions";
import AuditLog from "@/pages/docs/developer/AuditLog";
import Signers from "@/pages/docs/developer/Signers";
import QuickstartSession from "@/pages/docs/developer/QuickstartSession";
import QuickstartWebhooks from "@/pages/docs/developer/QuickstartWebhooks";
import SandboxDemo from "@/pages/docs/developer/SandboxDemo";

import Scim from "@/pages/docs/enterprise/Scim";
import CustomDomains from "@/pages/docs/enterprise/CustomDomains";
import Security from "@/pages/docs/enterprise/Security";
import ComplianceSheet from "@/pages/docs/enterprise/ComplianceSheet";

import QuickstartGuide from "@/pages/docs/developer/QuickstartGuide";

import CommonErrors from "@/pages/docs/troubleshooting/CommonErrors";
import MappingIssues from "@/pages/docs/troubleshooting/MappingIssues";

import Changelog from "@/pages/docs/changelog/Changelog";

function NotFound() {
  return (
    <div className="docs-content">
      <h1>Page not found</h1>
      <p>
        The page you're looking for doesn't exist. Use the sidebar to navigate,
        or <Link href="/getting-started/what-is-docuplete">start from the beginning</Link>.
      </p>
    </div>
  );
}

function Router() {
  return (
    <DocsLayout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/getting-started/what-is-docuplete" />} />

        {/* Getting Started */}
        <Route path="/getting-started/what-is-docuplete" component={WhatIsDocuplete} />
        <Route path="/getting-started/quick-start" component={QuickStart} />
        <Route path="/getting-started/plans" component={Plans} />

        {/* Core Concepts */}
        <Route path="/core-concepts/packages" component={Packages} />
        <Route path="/core-concepts/sessions" component={Sessions} />
        <Route path="/core-concepts/fields" component={Fields} />
        <Route path="/core-concepts/mappings" component={Mappings} />

        {/* Building a Package */}
        <Route path="/building-a-package/first-package" component={HowToFirstPackage} />
        <Route path="/building-a-package/uploading" component={Uploading} />
        <Route path="/building-a-package/acroform-review" component={AcroFormReview} />
        <Route path="/building-a-package/fields" component={BuildingFields} />
        <Route path="/building-a-package/esign-fields" component={EsignFields} />
        <Route path="/building-a-package/mapper" component={Mapper} />
        <Route path="/building-a-package/text-boxes" component={TextBoxes} />
        <Route path="/building-a-package/validation" component={Validation} />
        <Route path="/building-a-package/configuration" component={Configuration} />

        {/* Common Patterns */}
        <Route path="/common-patterns/conditional-sections" component={ConditionalSections} />
        <Route path="/common-patterns/unmapped-routing-fields" component={UnmappedRoutingFields} />
        <Route path="/common-patterns/checkbox-options" component={CheckboxOptions} />

        {/* Field Library */}
        <Route path="/field-library/overview" component={FieldLibraryOverview} />
        <Route path="/field-library/adding" component={AddingLibraryFields} />
        <Route path="/field-library/editing" component={EditingSharedFields} />
        <Route path="/field-library/best-practices" component={FieldLibraryBestPractices} />

        {/* Sending to Clients */}
        <Route path="/sending-to-clients/sessions" component={SendingSessions} />
        <Route path="/sending-to-clients/experience" component={Experience} />
        <Route path="/sending-to-clients/esign" component={EsignSending} />
        <Route path="/sending-to-clients/outcomes" component={Outcomes} />
        <Route path="/sending-to-clients/voiding" component={Voiding} />

        {/* Batch CSV */}
        <Route path="/batch-csv/overview" component={BatchOverview} />
        <Route path="/batch-csv/template" component={BatchTemplate} />
        <Route path="/batch-csv/filling" component={BatchFilling} />
        <Route path="/batch-csv/uploading" component={BatchUploading} />
        <Route path="/batch-csv/errors" component={BatchErrors} />

        {/* Sessions Dashboard */}
        <Route path="/sessions-dashboard/interviews" component={Interviews} />
        <Route path="/sessions-dashboard/batch-runs" component={BatchRuns} />

        {/* Webhooks & API */}
        <Route path="/webhooks/setup" component={WebhookSetup} />
        <Route path="/webhooks/payload" component={WebhookPayload} />
        <Route path="/webhooks/signature" component={WebhookSignature} />
        <Route path="/webhooks/retries" component={WebhookRetries} />
        <Route path="/webhooks/logs" component={WebhookLogs} />
        <Route path="/webhooks/rotating" component={WebhookRotating} />

        {/* Integrations */}
        <Route path="/integrations/google-drive" component={GoogleDrive} />
        <Route path="/integrations/hubspot" component={HubSpot} />

        {/* Developer API */}
        <Route path="/developer/authentication" component={DeveloperAuthentication} />
        <Route path="/developer/quickstart-guide" component={QuickstartGuide} />
        <Route path="/developer/sdk" component={Sdk} />
        <Route path="/developer/python-sdk" component={PythonSdk} />
        <Route path="/developer/bulk-sessions" component={BulkSessions} />
        <Route path="/developer/audit-log" component={AuditLog} />
        <Route path="/developer/signers" component={Signers} />
        <Route path="/developer/quickstart-session" component={QuickstartSession} />
        <Route path="/developer/quickstart-webhooks" component={QuickstartWebhooks} />
        <Route path="/developer/sandbox" component={SandboxDemo} />

        {/* Enterprise */}
        <Route path="/enterprise/security" component={Security} />
        <Route path="/enterprise/compliance-sheet" component={ComplianceSheet} />
        <Route path="/enterprise/scim" component={Scim} />
        <Route path="/enterprise/custom-domains" component={CustomDomains} />

        {/* Account & Settings */}
        <Route path="/account/billing" component={Billing} />
        <Route path="/account/branding" component={Branding} />
        <Route path="/account/channels" component={Channels} />
        <Route path="/account/api-keys" component={ApiKeys} />

        {/* Troubleshooting */}
        <Route path="/troubleshooting/common-errors" component={CommonErrors} />
        <Route path="/troubleshooting/mapping" component={MappingIssues} />

        {/* What's New */}
        <Route path="/changelog" component={Changelog} />

        <Route component={NotFound} />
      </Switch>
    </DocsLayout>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}
