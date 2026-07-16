import { createRouter, createWebHashHistory } from "vue-router"

const routes = [
  { path: "/", redirect: "/items" },
  { path: "/items", name: "Items", component: () => import("@/views/HomeView.vue") },
  { path: "/home", redirect: "/items" },
  { path: "/spaces/:id", name: "SpaceDetail", component: () => import("@/views/SpaceDetailView.vue") },
  { path: "/bag/:id", redirect: (to) => `/spaces/${to.params.id}` },
  { path: "/room/:id", redirect: (to) => `/spaces/${to.params.id}` },
  { path: "/item/:id", name: "ItemDetail", component: () => import("@/views/ItemDetailView.vue") },
  { path: "/plans", name: "Plans", component: () => import("@/views/TripsView.vue") },
  { path: "/plans/:id", name: "PlanDetail", component: () => import("@/views/TripDetailView.vue") },
  { path: "/trips", redirect: "/plans" },
  { path: "/trips/:id", redirect: (to) => `/plans/${to.params.id}` },
  { path: "/community", name: "Community", component: () => import("@/views/CommunityView.vue") },
  { path: "/me", name: "Me", component: () => import("@/views/UserCenterView.vue") },
  { path: "/me/updates", name: "ReleaseNotes", component: () => import("@/views/ReleaseNotesView.vue") },
  { path: "/user", redirect: "/me" },
  { path: "/settings", redirect: "/me" },
]

export default createRouter({ history: createWebHashHistory(), routes })
