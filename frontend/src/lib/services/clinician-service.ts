import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { firebaseClinicianService } from "@/lib/services/firebase-services";
import { remoteClinicianService } from "@/lib/services/remote-services";
import { selectDataProvider } from "@/lib/services/service-provider";

export type { ClinicianService } from "@/lib/services/contracts";

export const clinicianService = selectDataProvider(
  demoClinicianService,
  remoteClinicianService,
  firebaseClinicianService,
);
