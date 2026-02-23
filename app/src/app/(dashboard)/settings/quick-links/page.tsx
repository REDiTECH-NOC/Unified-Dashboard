"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bookmark,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Shield,
  X,
  Link as LinkIcon,
  FolderOpen,
  FolderClosed,
  FolderPlus,
  Users,
  Copy,
  ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

type ItemRecord = {
  id: string;
  groupId: string;
  parentId: string | null;
  type: string;
  title: string;
  url: string | null;
  sortOrder: number;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: ItemRecord[];
  assignments: {
    id: string;
    role: string | null;
    userId: string | null;
    user: { id: string; name: string | null; email: string } | null;
  }[];
};

const ROLE_OPTIONS = ["ADMIN", "MANAGER", "USER", "CLIENT"] as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-500/10 text-red-400 border-red-500/20",
  MANAGER: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  USER: "bg-green-500/10 text-green-400 border-green-500/20",
  CLIENT: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

// Build tree from flat item list for display
type TreeNode = ItemRecord & { children: TreeNode[] };

function buildTreeNodes(items: ItemRecord[], parentId: string | null): TreeNode[] {
  return items
    .filter((i) => i.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      ...item,
      children: buildTreeNodes(items, item.id),
    }));
}

function getFaviconUrl(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

// ── Tree Item Row ──
function TreeItemRow({
  node,
  depth,
  siblings,
  index,
  expandedFolders,
  onToggleFolder,
  onEdit,
  onDelete,
  onMove,
  onMoveOrder,
}: {
  node: TreeNode;
  depth: number;
  siblings: TreeNode[];
  index: number;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (id: string) => void;
  onEdit: (item: ItemRecord) => void;
  onDelete: (item: ItemRecord) => void;
  onMove: (item: ItemRecord) => void;
  onMoveOrder: (itemId: string, direction: "up" | "down", siblingIds: string[]) => void;
}) {
  const isFolder = node.type === "FOLDER";
  const isExpanded = expandedFolders[node.id] ?? true; // default open
  const faviconUrl = node.url ? getFaviconUrl(node.url) : null;
  const siblingIds = siblings.map((s) => s.id);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded-md border border-border p-2 group hover:border-primary/30 transition-colors"
        style={{ marginLeft: depth * 24 }}
      >
        {/* Reorder arrows */}
        <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoveOrder(node.id, "up", siblingIds)}
            disabled={index === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMoveOrder(node.id, "down", siblingIds)}
            disabled={index === siblings.length - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Folder toggle / icon */}
        {isFolder ? (
          <button onClick={() => onToggleFolder(node.id)} className="flex items-center gap-1.5">
            <ChevronRight className={"h-3.5 w-3.5 text-muted-foreground transition-transform " + (isExpanded ? "rotate-90" : "")} />
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500/80 flex-shrink-0" />
            ) : (
              <FolderClosed className="h-4 w-4 text-amber-500/60 flex-shrink-0" />
            )}
          </button>
        ) : (
          <div className="pl-5">
            {faviconUrl ? (
              <img src={faviconUrl} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
            ) : (
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        )}

        {/* Title + URL */}
        <div className="flex-1 min-w-0 ml-1">
          <p className="text-sm font-medium truncate">{node.title}</p>
          {node.url && <p className="text-[10px] text-muted-foreground truncate">{node.url}</p>}
          {isFolder && (
            <p className="text-[10px] text-muted-foreground">
              {node.children.length} {node.children.length === 1 ? "item" : "items"}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {node.url && (
            <button onClick={() => window.open(node.url!, "_blank", "noopener,noreferrer")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Open">
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => onMove(node)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Move to folder">
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onEdit(node)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(node)} className="p-1 rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {isFolder && isExpanded && node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child, i) => (
            <TreeItemRow
              key={child.id}
              node={child}
              depth={depth + 1}
              siblings={node.children}
              index={i}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onMoveOrder={onMoveOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function QuickLinksSettingsPage() {
  const utils = trpc.useUtils();
  const { data: groups, isLoading } = trpc.quicklinks.listAll.useQuery();
  const { data: allUsers } = trpc.user.list.useQuery();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Dialog states
  const [groupDialog, setGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  const [itemDialog, setItemDialog] = useState(false);
  const [itemType, setItemType] = useState<"FOLDER" | "LINK">("LINK");
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemParentId, setItemParentId] = useState<string | null>(null);

  const [moveDialog, setMoveDialog] = useState(false);
  const [movingItem, setMovingItem] = useState<ItemRecord | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  const [assignDialog, setAssignDialog] = useState(false);
  const [assignType, setAssignType] = useState<"role" | "user">("role");
  const [assignRole, setAssignRole] = useState<string>("");
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");

  const [copyDialog, setCopyDialog] = useState(false);
  const [copyName, setCopyName] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "group" | "item"; id: string; name: string; isFolder?: boolean } | null>(null);

  // Mutations
  const invalidate = () => utils.quicklinks.listAll.invalidate();
  const createGroup = trpc.quicklinks.createGroup.useMutation({ onSuccess: () => { invalidate(); setGroupDialog(false); } });
  const updateGroup = trpc.quicklinks.updateGroup.useMutation({ onSuccess: () => { invalidate(); setGroupDialog(false); } });
  const deleteGroup = trpc.quicklinks.deleteGroup.useMutation({ onSuccess: () => { invalidate(); setSelectedGroupId(null); setDeleteConfirm(null); } });
  const copyGroup = trpc.quicklinks.copyGroup.useMutation({ onSuccess: () => { invalidate(); setCopyDialog(false); } });
  const createItem = trpc.quicklinks.createItem.useMutation({ onSuccess: () => { invalidate(); setItemDialog(false); } });
  const updateItem = trpc.quicklinks.updateItem.useMutation({ onSuccess: () => { invalidate(); setItemDialog(false); } });
  const deleteItem = trpc.quicklinks.deleteItem.useMutation({ onSuccess: () => { invalidate(); setDeleteConfirm(null); } });
  const moveItem = trpc.quicklinks.moveItem.useMutation({ onSuccess: invalidate });
  const reorderItems = trpc.quicklinks.reorderItems.useMutation({ onSuccess: invalidate });
  const assignGroup = trpc.quicklinks.assignGroup.useMutation({ onSuccess: () => { invalidate(); setAssignDialog(false); } });
  const unassignGroup = trpc.quicklinks.unassignGroup.useMutation({ onSuccess: invalidate });

  const selectedGroup = groups?.find((g) => g.id === selectedGroupId) ?? null;
  const tree = selectedGroup ? buildTreeNodes(selectedGroup.items, null) : [];

  // Get all folders in the selected group (for move-to and create-in-folder)
  const allFolders: { id: string; title: string; depth: number }[] = [];
  function collectFolders(nodes: TreeNode[], depth: number) {
    for (const n of nodes) {
      if (n.type === "FOLDER") {
        allFolders.push({ id: n.id, title: n.title, depth });
        if (depth < 1) collectFolders(n.children, depth + 1); // max 2 levels
      }
    }
  }
  collectFolders(tree, 0);

  // --- Group dialog ---
  function openNewGroup() {
    setEditingGroup(null); setGroupName(""); setGroupDescription(""); setGroupDialog(true);
  }
  function openEditGroup(g: Group) {
    setEditingGroup(g); setGroupName(g.name); setGroupDescription(g.description ?? ""); setGroupDialog(true);
  }
  function handleSaveGroup() {
    if (editingGroup) updateGroup.mutate({ id: editingGroup.id, name: groupName, description: groupDescription || null });
    else createGroup.mutate({ name: groupName, description: groupDescription || undefined });
  }

  // --- Item dialog ---
  function openNewItem(type: "FOLDER" | "LINK", parentId?: string | null) {
    setEditingItem(null); setItemType(type); setItemTitle(""); setItemUrl(type === "LINK" ? "https://" : ""); setItemParentId(parentId ?? null); setItemDialog(true);
  }
  function openEditItem(item: ItemRecord) {
    setEditingItem(item); setItemType(item.type as "FOLDER" | "LINK"); setItemTitle(item.title); setItemUrl(item.url ?? ""); setItemParentId(item.parentId); setItemDialog(true);
  }
  function handleSaveItem() {
    if (!selectedGroupId) return;
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, title: itemTitle, url: itemType === "LINK" ? itemUrl : undefined });
    } else {
      createItem.mutate({
        groupId: selectedGroupId,
        parentId: itemParentId || undefined,
        type: itemType,
        title: itemTitle,
        url: itemType === "LINK" ? itemUrl : undefined,
      });
    }
  }

  // --- Move item ---
  function openMoveDialog(item: ItemRecord) {
    setMovingItem(item); setMoveTargetId(item.parentId); setMoveDialog(true);
  }
  function handleMove() {
    if (!movingItem) return;
    moveItem.mutate({ id: movingItem.id, newParentId: moveTargetId });
    setMoveDialog(false);
  }

  // --- Reorder ---
  function handleReorder(itemId: string, direction: "up" | "down", siblingIds: string[]) {
    if (!selectedGroupId) return;
    const idx = siblingIds.indexOf(itemId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblingIds.length) return;
    const newOrder = [...siblingIds];
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    // Determine parentId from the item
    const item = selectedGroup?.items.find((i) => i.id === itemId);
    reorderItems.mutate({ groupId: selectedGroupId, parentId: item?.parentId ?? null, itemIds: newOrder });
  }

  // --- Copy group ---
  function openCopyDialog() {
    if (!selectedGroup) return;
    setCopyName(selectedGroup.name + " (Copy)"); setCopyDialog(true);
  }

  // --- Toggle folder in tree view ---
  function toggleFolder(id: string) {
    setExpandedFolders((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }

  // --- Assignments ---
  const assignedRoles = new Set(selectedGroup?.assignments.filter((a) => a.role).map((a) => a.role));
  const assignedUserIds = new Set(selectedGroup?.assignments.filter((a) => a.userId).map((a) => a.userId));
  const availableRoles = ROLE_OPTIONS.filter((r) => !assignedRoles.has(r));
  const filteredUsers = (allUsers ?? []).filter(
    (u) => !assignedUserIds.has(u.id) && (u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Move targets: only folders the item can validly move to
  const moveTargets = allFolders.filter((f) => {
    if (!movingItem) return true;
    if (f.id === movingItem.id) return false; // can't move into self
    if (movingItem.type === "FOLDER" && f.depth > 0) return false; // folder can only go at root or 1 deep
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quick Links</h2>
        <p className="text-sm text-muted-foreground">
          Manage shortcut links and folders organized by groups. Assign groups to roles or individual users.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left panel: Groups */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Link Groups</h3>
            <Button variant="outline" size="sm" onClick={openNewGroup} className="gap-1.5 h-7 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add Group
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />)}</div>
          ) : groups?.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No groups yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {groups?.map((group) => {
                const folderCount = group.items.filter((i) => i.type === "FOLDER").length;
                const linkCount = group.items.filter((i) => i.type === "LINK").length;
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={"w-full text-left rounded-lg border p-3 transition-colors " + (selectedGroupId === group.id ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-primary/30")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{group.name}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        {folderCount > 0 && <Badge variant="secondary" className="text-[10px]">{folderCount} {folderCount === 1 ? "folder" : "folders"}</Badge>}
                        <Badge variant="secondary" className="text-[10px]">{linkCount} {linkCount === 1 ? "link" : "links"}</Badge>
                      </div>
                    </div>
                    {group.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{group.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {group.assignments.map((a) => (
                        <span key={a.id} className={"inline-flex items-center text-[9px] px-1.5 py-0 rounded border " + (a.role ? (ROLE_COLORS[a.role] || "bg-muted text-muted-foreground border-border") : "bg-muted text-muted-foreground border-border")}>
                          {a.role || a.user?.name || a.user?.email || "User"}
                        </span>
                      ))}
                      {group.assignments.length === 0 && <span className="text-[9px] text-muted-foreground/50">No assignments</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: Selected group */}
        <div>
          {!selectedGroup ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Bookmark className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{groups?.length === 0 ? "Create a group to get started" : "Select a group to manage"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Group header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedGroup.name}</CardTitle>
                      {selectedGroup.description && <p className="text-xs text-muted-foreground mt-0.5">{selectedGroup.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={openCopyDialog} className="h-7 text-xs gap-1">
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditGroup(selectedGroup as Group)} className="h-7 text-xs gap-1">
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteConfirm({ type: "group", id: selectedGroup.id, name: selectedGroup.name })} className="h-7 text-xs gap-1 text-red-400 hover:text-red-300 hover:border-red-500/30">
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Items tree */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      Contents ({selectedGroup.items.length})
                    </CardTitle>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openNewItem("FOLDER")} className="gap-1.5 h-7 text-xs">
                        <FolderPlus className="h-3.5 w-3.5" />
                        Folder
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openNewItem("LINK")} className="gap-1.5 h-7 text-xs">
                        <Plus className="h-3.5 w-3.5" />
                        Link
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tree.length === 0 ? (
                    <div className="py-6 text-center">
                      <LinkIcon className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No items yet. Add folders and links above.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {tree.map((node, i) => (
                        <TreeItemRow
                          key={node.id}
                          node={node}
                          depth={0}
                          siblings={tree}
                          index={i}
                          expandedFolders={expandedFolders}
                          onToggleFolder={toggleFolder}
                          onEdit={openEditItem}
                          onDelete={(item) => setDeleteConfirm({ type: "item", id: item.id, name: item.title, isFolder: item.type === "FOLDER" })}
                          onMove={openMoveDialog}
                          onMoveOrder={handleReorder}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assignments */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Visibility ({selectedGroup.assignments.length})
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => { setAssignType("role"); setAssignRole(""); setAssignUserId(""); setUserSearch(""); setAssignDialog(true); }} className="gap-1.5 h-7 text-xs">
                      <UserPlus className="h-3.5 w-3.5" />
                      Assign
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedGroup.assignments.length === 0 ? (
                    <div className="py-6 text-center">
                      <Shield className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No one can see this group yet. Assign it to roles or users.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedGroup.assignments.map((a) => (
                        <span key={a.id} className={"inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border " + (a.role ? (ROLE_COLORS[a.role] || "bg-muted text-muted-foreground border-border") : "bg-muted text-muted-foreground border-border")}>
                          {a.role ? (<><Shield className="h-3 w-3" />All {a.role}s</>) : (<><Users className="h-3 w-3" />{a.user?.name || a.user?.email || "Unknown"}</>)}
                          <button onClick={() => unassignGroup.mutate({ id: a.id })} className="ml-0.5 hover:text-foreground" title="Remove"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── Group Dialog ── */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent onClose={() => setGroupDialog(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "New Group"}</DialogTitle>
            <DialogDescription>Groups organize links for assignment to roles or users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., All Technicians" className="text-sm" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
              <Input value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Short description" className="text-sm" />
            </div>
          </div>
          {(createGroup.error || updateGroup.error) && <p className="text-sm text-red-400">{(createGroup.error || updateGroup.error)?.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={!groupName.trim() || createGroup.isPending || updateGroup.isPending}>
              {createGroup.isPending || updateGroup.isPending ? "Saving..." : editingGroup ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item Dialog (Folder or Link) ── */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent onClose={() => setItemDialog(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${itemType === "FOLDER" ? "Folder" : "Link"}` : `Add ${itemType === "FOLDER" ? "Folder" : "Link"}`}</DialogTitle>
            <DialogDescription>
              {itemType === "FOLDER" ? "Folders organize links in the dropdown menu." : "Links open in a new tab when clicked."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <Input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder={itemType === "FOLDER" ? "e.g., Security Tools" : "e.g., SentinelOne Console"} className="text-sm" autoFocus />
            </div>
            {itemType === "LINK" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">URL</label>
                <Input value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} placeholder="https://example.com" className="text-sm font-mono" />
              </div>
            )}
            {!editingItem && allFolders.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Create inside folder (optional)</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <button
                    onClick={() => setItemParentId(null)}
                    className={"w-full text-left px-2 py-1.5 rounded text-sm border transition-colors " + (!itemParentId ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-accent")}
                  >
                    Root (top level)
                  </button>
                  {allFolders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setItemParentId(f.id)}
                      className={"w-full text-left px-2 py-1.5 rounded text-sm border transition-colors flex items-center gap-2 " + (itemParentId === f.id ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-accent")}
                      style={{ paddingLeft: 8 + f.depth * 16 }}
                    >
                      <FolderClosed className="h-3.5 w-3.5 text-amber-500/60" />
                      {f.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {itemType === "LINK" && itemUrl && itemUrl !== "https://" && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-xs text-muted-foreground">
                {getFaviconUrl(itemUrl) ? <img src={getFaviconUrl(itemUrl)!} alt="" className="w-4 h-4 rounded-sm" /> : <ExternalLink className="h-4 w-4" />}
                <span>Preview: {itemTitle || "Untitled"}</span>
              </div>
            )}
          </div>
          {(createItem.error || updateItem.error) && <p className="text-sm text-red-400">{(createItem.error || updateItem.error)?.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveItem} disabled={!itemTitle.trim() || (itemType === "LINK" && !itemUrl.trim()) || createItem.isPending || updateItem.isPending}>
              {createItem.isPending || updateItem.isPending ? "Saving..." : editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move Dialog ── */}
      <Dialog open={moveDialog} onOpenChange={setMoveDialog}>
        <DialogContent onClose={() => setMoveDialog(false)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move &ldquo;{movingItem?.title}&rdquo;</DialogTitle>
            <DialogDescription>Select a destination folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => setMoveTargetId(null)}
              className={"w-full text-left px-3 py-2 rounded text-sm border transition-colors " + (moveTargetId === null ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-accent")}
            >
              Root (top level)
            </button>
            {moveTargets.map((f) => (
              <button
                key={f.id}
                onClick={() => setMoveTargetId(f.id)}
                className={"w-full text-left px-3 py-2 rounded text-sm border transition-colors flex items-center gap-2 " + (moveTargetId === f.id ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-accent")}
                style={{ paddingLeft: 12 + f.depth * 16 }}
              >
                <FolderClosed className="h-3.5 w-3.5 text-amber-500/60" />
                {f.title}
              </button>
            ))}
          </div>
          {moveItem.error && <p className="text-sm text-red-400">{moveItem.error.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialog(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={moveItem.isPending}>{moveItem.isPending ? "Moving..." : "Move"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Copy Group Dialog ── */}
      <Dialog open={copyDialog} onOpenChange={setCopyDialog}>
        <DialogContent onClose={() => setCopyDialog(false)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Copy Group</DialogTitle>
            <DialogDescription>Creates a duplicate of &ldquo;{selectedGroup?.name}&rdquo; with all its folders and links.</DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">New group name</label>
            <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} className="text-sm" autoFocus />
          </div>
          {copyGroup.error && <p className="text-sm text-red-400">{copyGroup.error.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialog(false)}>Cancel</Button>
            <Button onClick={() => selectedGroupId && copyGroup.mutate({ id: selectedGroupId, newName: copyName })} disabled={!copyName.trim() || copyGroup.isPending}>
              {copyGroup.isPending ? "Copying..." : "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assignment Dialog ── */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent onClose={() => setAssignDialog(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Group</DialogTitle>
            <DialogDescription>Choose who can see &ldquo;{selectedGroup?.name}&rdquo;</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setAssignType("role")} className={"flex-1 py-2 text-xs font-medium transition-colors " + (assignType === "role" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>By Role</button>
              <button onClick={() => setAssignType("user")} className={"flex-1 py-2 text-xs font-medium transition-colors border-l border-border " + (assignType === "user" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>By User</button>
            </div>
            {assignType === "role" ? (
              <div className="space-y-1.5">
                {availableRoles.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">All roles assigned</p> : availableRoles.map((role) => (
                  <button key={role} onClick={() => setAssignRole(role)} className={"w-full flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors " + (assignRole === role ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30")}>
                    <Shield className="h-4 w-4 text-muted-foreground" /><span>All <strong>{role}</strong> users</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users..." className="text-sm" />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No matching users</p> : filteredUsers.slice(0, 20).map((user) => (
                    <button key={user.id} onClick={() => setAssignUserId(user.id)} className={"w-full flex items-center gap-2 p-2 rounded-lg border text-sm transition-colors " + (assignUserId === user.id ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30")}>
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="text-left min-w-0"><p className="truncate">{user.name || "Unnamed"}</p><p className="text-[10px] text-muted-foreground truncate">{user.email}</p></div>
                      <Badge variant="secondary" className="ml-auto text-[9px] flex-shrink-0">{user.role}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {assignGroup.error && <p className="text-sm text-red-400">{assignGroup.error.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={() => { if (!selectedGroupId) return; if (assignType === "role" && assignRole) assignGroup.mutate({ groupId: selectedGroupId, role: assignRole as typeof ROLE_OPTIONS[number] }); else if (assignType === "user" && assignUserId) assignGroup.mutate({ groupId: selectedGroupId, userId: assignUserId }); }} disabled={(assignType === "role" && !assignRole) || (assignType === "user" && !assignUserId) || assignGroup.isPending}>
              {assignGroup.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteConfirm?.type === "group" ? "Group" : deleteConfirm?.isFolder ? "Folder" : "Link"}</DialogTitle>
            <DialogDescription>
              {deleteConfirm?.type === "group"
                ? `Delete "${deleteConfirm.name}" and all its contents and assignments?`
                : deleteConfirm?.isFolder
                  ? `Delete folder "${deleteConfirm?.name}" and everything inside it?`
                  : `Delete "${deleteConfirm?.name}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (!deleteConfirm) return; if (deleteConfirm.type === "group") deleteGroup.mutate({ id: deleteConfirm.id }); else deleteItem.mutate({ id: deleteConfirm.id }); }} disabled={deleteGroup.isPending || deleteItem.isPending}>
              {deleteGroup.isPending || deleteItem.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
