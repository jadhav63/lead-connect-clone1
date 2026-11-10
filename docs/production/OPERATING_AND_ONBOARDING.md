# Operating and employee onboarding procedure

This procedure is prepared for the future approved production origin. Staging remains synthetic and is not a staff system.

## Account setup

The owner uses a named ADMIN account with an independent password-manager-generated password. Bootstrap runs only on an empty, independently verified new production database. Use the existing `npm run db:bootstrap` with private process environment values for property name/code and owner identity/password; never put passwords in commands, chat, source or shared documents. The production runtime identity guard still applies. Production bootstrap also requires property name Tombstone Grand Hotel, code 58835, a matching BOOTSTRAP_CONFIRM_PROPERTY_CODE and BOOTSTRAP_APPROVAL_REFERENCE; demo identities/secrets are refused. Remove bootstrap password values from the process/secret store immediately afterward.

A manager creates each FRONT_DESK, HOUSEKEEPING or MAINTENANCE account with that person's unique identity and unique temporary password. Deliver that password privately to the individual. Each employee signs in, opens Account, chooses their own 12–128 character password and signs in again. The manager confirms the UserPassword audit event. The application does not enforce a first-login change, so this is a required supervised onboarding step, not an automatic control.

ADMIN can provision MANAGER accounts; MANAGER can provision operational staff but cannot elevate someone to MANAGER. Never share accounts across employees or properties. Never copy any `DEMO_*` variable into production. Runtime production configuration contains no demo passwords. Review membership at hire/transfer/termination; deactivate membership immediately when access ends. Each API request rechecks active membership, so deactivation denies existing access tokens.

Lost password: suspend membership, verify the employee's identity through the named owner, and use an approved operator recovery procedure. An end-user email reset flow is not available; recovery must be resolved and rehearsed before broad staff enrollment. A password change revokes refresh sessions, but previously issued bearer tokens can last up to 15 minutes. Deactivation provides immediate removal while a security incident is investigated.

## Daily use

1. Front desk/manager selects the Arizona business date and refreshes the dashboard. Reconcile departures, arrivals and stayovers with the authorized existing PMS manually. Occupancy import accepts room identifiers/status only, not guest/reservation records.
2. Manager/front desk assigns cleaning to active HOUSEKEEPING members. Employees refresh Housekeeping and see assigned work; they Start when beginning and Complete when finished. Do not mark completion during a connection failure.
3. Supervisor inspects. Verify clean moves the room to CLEAN. If the inspection fails, give an operational reason and Return for cleaning; the assigned employee receives a notification, finishes rework and returns it for inspection.
4. Maintenance tickets record the issue, priority, responsible technician, work progress and completion notes. Ticket closure does not automatically release an unavailable room. A supervisor/front desk makes and audits the availability decision. Daily maintenance checklist functionality is still a launch gate.
5. Front desk performs the assigned A/B/C tasks, records handover notes and obtains verification from a different incoming employee. Manager verifies completed tasks. Actual approved task lists must be configured before a pilot.
6. Managers refresh Notifications and Activity, read outstanding items, and reconcile daily/monthly cleaning totals. Notifications are in-app and require refresh; no SMS, WhatsApp, email or push dispatch is claimed.
7. Print the dated housekeeping board before a shift and retain a paper fallback. Reports distinguish estimated cleaning minutes from start-to-complete elapsed minutes. Elapsed includes breaks, pauses and rework delays; it must not be used as paid working time.

## Outage and uncertain saves

If no Saved confirmation appears, check the existing record after connectivity returns before retrying. Mutations are not blindly retried. Version conflicts require refresh and review. Do not assume a failed network response proves that the server did not commit the action.

During an outage, use the dated paper board and record room number, responsible employee, action and actual time. Keep a single designated supervisor responsible for reconciliation after recovery. Avoid entering the same task twice. Check room history, audit events and report totals before clearing the incident. Do not place guest/payment information in operational notes.

Sign out on shared devices. If Sign out cannot be confirmed, reconnect and retry; close the browser and notify the manager if the device is changing hands. Device lock and individual user accounts remain required.
