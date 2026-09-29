# Runtime ERD (high-level)

```text
schools 1---n users
users n---n roles              (user_roles)
schools 1---n students
students n---n guardians       (student_guardians)
schools 1---n conversations
conversations n---n users      (conversation_participants)
conversations 1---n messages
users 1---n approvals          (requested_by / approved_by)
schools 1---n result_publications
schools 1---n delivery_outbox
```

The canonical relational schema is `backend-node/database.sql`. Runtime
compatibility migrations are in `backend-node/src/config/db.js` and are kept
additive so existing school data is not reset.
