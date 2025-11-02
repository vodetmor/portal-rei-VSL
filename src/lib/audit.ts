
'use client';

import { Firestore, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";

interface LogEntity {
    type: string;
    id: string;
    title: string;
}

/**
 * Creates a log entry in the 'auditLogs' collection.
 * This is a non-blocking operation.
 * @param firestore Firestore instance.
 * @param adminUser The authenticated admin user performing the action.
 * @param action A string describing the action (e.g., 'course_created').
 * @param entity The entity that was affected by the action.
 */
export async function logAdminAction(
    firestore: Firestore,
    adminUser: User,
    action: string,
    entity: LogEntity
): Promise<void> {
    if (!adminUser) {
        console.error("Audit log failed: Admin user not provided.");
        return;
    }

    try {
        const logData = {
            adminId: adminUser.uid,
            adminEmail: adminUser.email,
            action: action,
            entityType: entity.type,
            entityId: entity.id,
            entityTitle: entity.title,
            timestamp: serverTimestamp(),
        };

        // Non-blocking write to the audit log
        await addDoc(collection(firestore, 'auditLogs'), logData);

    } catch (error) {
        // We don't want to block the UI or show an error to the user for a failed audit log.
        // We just log it to the console for debugging purposes.
        console.error("Failed to write to audit log:", error);
    }
}
