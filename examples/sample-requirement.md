# Example requirement: Shared task board

Build a shared task board for small teams. A signed-in user can create a workspace, invite members by email, create tasks, assign one member, set an optional due date, move tasks between To Do, In Progress, and Done, and view a chronological activity log.

Workspace owners can remove members and delete the workspace. Removed members immediately lose access. Users must never see workspaces they do not belong to. The initial release is a responsive web experience and does not need native mobile apps, recurring tasks, file attachments, or integrations.

Acceptance criteria:

- A new user can create a workspace and invite another user.
- Both users see task changes without manually refreshing.
- Unauthorized workspace requests are rejected.
- Each create, assignment, status, and deletion event appears in the activity log.
- The main board remains usable at 375 px viewport width.

Try it with **Just Spec It: Generate Spec Docs** using **Read from a file**. Review how the extension converts this single input into requirements, architecture, phases, decisions, tasks, and project memory.
