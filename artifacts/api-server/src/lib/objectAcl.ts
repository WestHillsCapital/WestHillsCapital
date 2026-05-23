import { HeadObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "./r2Client";

const ACL_POLICY_METADATA_KEY = "aclpolicy";

export interface R2ObjectHandle {
  bucket: string;
  key: string;
  name: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export async function setObjectAclPolicy(
  handle: R2ObjectHandle,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const head = await r2Client.send(new HeadObjectCommand({
    Bucket: handle.bucket,
    Key: handle.key,
  }));

  const existingMeta = head.Metadata ?? {};
  const newMeta: Record<string, string> = {
    ...existingMeta,
    [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
  };

  await r2Client.send(new CopyObjectCommand({
    Bucket: handle.bucket,
    CopySource: `${handle.bucket}/${handle.key}`,
    Key: handle.key,
    Metadata: newMeta,
    MetadataDirective: "REPLACE",
    ContentType: head.ContentType,
  }));
}

export async function getObjectAclPolicy(
  handle: R2ObjectHandle,
): Promise<ObjectAclPolicy | null> {
  try {
    const head = await r2Client.send(new HeadObjectCommand({
      Bucket: handle.bucket,
      Key: handle.key,
    }));
    const raw = head.Metadata?.[ACL_POLICY_METADATA_KEY];
    if (!raw) return null;
    return JSON.parse(raw) as ObjectAclPolicy;
  } catch {
    return null;
  }
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: R2ObjectHandle;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) return false;

  if (aclPolicy.visibility === "public" && requestedPermission === ObjectPermission.READ) {
    return true;
  }

  if (!userId) return false;

  return aclPolicy.owner === userId;
}
