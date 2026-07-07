// OS Event Bus — subscription boot.
//
// Every app that subscribes to events registers here (side-effect
// imports). Order matters only in that registrations for the SAME
// eventType run in registration order.
//
// Adding a new subscriber:
//   1. Create src/lib/os/events/subscriptions/<slug>.ts
//   2. Call register({...}) at module scope
//   3. Import it below.
import "./crm";
import "./jobDiary";
import "./reviews";
import "./businessHub";
import "./products";

export {};
