import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api/api";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerStaff.css";

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const STAFF_PHOTOS_KEY = "managerStaffProfilePhotos";

const loadSavedStaffPhotos = () => {
  try {
    return JSON.parse(localStorage.getItem(STAFF_PHOTOS_KEY) || "{}");
  } catch {
    return {};
  }
};

const readProfilePhoto = (file) => new Promise((resolve, reject) => {
  if (!file || !file.type.startsWith("image/")) {
    reject(new Error("Choose an image file for the profile photo."));
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    reject(new Error("Choose an image smaller than 10 MB."));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error("The selected image could not be read."));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error("The selected file is not a supported image."));
    image.onload = () => {
      const maxDimension = 512;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function StaffManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [profilePhotos, setProfilePhotos] = useState(loadSavedStaffPhotos);
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [roles, setRoles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksAvailable, setTasksAvailable] = useState(null);
  const [activeTab, setActiveTab] = useState("staff");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState("");
  const [editRole, setEditRole] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [createdPassword, setCreatedPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [roleFormError, setRoleFormError] = useState("");

  useEffect(() => {
    setActiveTab(new URLSearchParams(location.search).get("tab") === "roles" ? "roles" : "staff");
  }, [location.search]);

  const selectTab = (tab) => {
    navigate({ pathname: location.pathname, search: tab === "roles" ? "?tab=roles" : "" });
  };

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get("manager/staff/"),
      api.get("roles/"),
      api.get("manager/tasks/"),
    ]);
    const [staffResult, rolesResult, tasksResult] = results;
    if (staffResult.status === "fulfilled") {
      setStaff(asList(staffResult.value.data));
      setLoadError("");
    } else {
      setLoadError(staffResult.reason.response?.data?.detail || "Staff could not be loaded.");
    }
    if (rolesResult.status === "fulfilled") setRoles(asList(rolesResult.value.data));
    if (tasksResult.status === "fulfilled") {
      setTasks(asList(tasksResult.value.data));
      setTasksAvailable(true);
    } else {
      setTasksAvailable(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const taskByStaffId = useMemo(() => {
    const grouped = new Map();
    tasks.forEach((task) => {
      if (task.assigned_to === null || task.assigned_to === undefined) return;
      const key = String(task.assigned_to);
      grouped.set(key, [...(grouped.get(key) || []), task]);
    });
    return grouped;
  }, [tasks]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return staff.filter((member) => [member.username, member.email, member.role_name]
      .filter(Boolean).join(" ").toLocaleLowerCase().includes(query));
  }, [staff, search]);

  const resetForm = () => {
    setFormOpen(false);
    setEditingStaff(null);
    setNewUsername("");
    setNewRole("");
    setEditRole("");
    setFormError("");
  };

  const openCreateForm = () => {
    setEditingStaff(null);
    setNewUsername("");
    setNewRole("");
    setCreatedPassword(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (member) => {
    const assignedRole = roles.find((role) => role.name === member.role_name);
    setEditingStaff(member);
    setEditRole(assignedRole ? String(assignedRole.id) : "");
    setFormError("");
    setFormOpen(true);
  };

  const handleProfilePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedStaff) return;
    setProfilePhotoError("");
    try {
      const photo = await readProfilePhoto(file);
      const updatedPhotos = { ...profilePhotos, [selectedStaff.id]: photo };
      localStorage.setItem(STAFF_PHOTOS_KEY, JSON.stringify(updatedPhotos));
      setProfilePhotos(updatedPhotos);
    } catch (error) {
      setProfilePhotoError(error.message || "Profile photo could not be saved in this browser.");
    }
  };

  const removeProfilePhoto = () => {
    if (!selectedStaff) return;
    const updatedPhotos = { ...profilePhotos };
    delete updatedPhotos[selectedStaff.id];
    localStorage.setItem(STAFF_PHOTOS_KEY, JSON.stringify(updatedPhotos));
    setProfilePhotos(updatedPhotos);
    setProfilePhotoError("");
  };

  const createStaff = async (event) => {
    event.preventDefault();
    if (!newUsername || !newRole) {
      setFormError("Username and role required");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await api.post("manager/staff/create/", {
        username: newUsername,
        role: newRole,
      });
      setCreatedPassword(response.data.password);
      setNewUsername("");
      setNewRole("");
      await loadData();
    } catch (error) {
      setFormError(error.response?.data?.detail || "Staff member could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (event) => {
    event.preventDefault();
    if (!editingStaff || !editRole) {
      setFormError("Select a role to continue.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api.patch(`manager/staff/${editingStaff.id}/`, { role: editRole });
      resetForm();
      await loadData();
    } catch (error) {
      setFormError(error.response?.data?.detail || "Role could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (event) => {
    event.preventDefault();
    const name = newRoleName.trim();
    if (!name) {
      setRoleFormError("Role name is required.");
      return;
    }
    setRoleSaving(true);
    setRoleFormError("");
    try {
      await api.post("roles/", { name });
      setNewRoleName("");
      setRoleFormOpen(false);
      await loadData();
    } catch (error) {
      const data = error.response?.data;
      setRoleFormError(data?.detail || data?.name?.[0] || "Role could not be created.");
    } finally {
      setRoleSaving(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(createdPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError("Copy failed. Please copy manually.");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date());

  return (
    <div className="manager-dashboard manager-staff-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb"><p className="manager-dashboard__eyebrow">MANAGER AREA</p><span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span><p className="manager-dashboard__crumb">Staff</p></div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content manager-staff-page__content">
          <section className="manager-dashboard__page-heading manager-staff-page__heading">
            <div><h1>Staff</h1><p>{staff.length} {staff.length === 1 ? "team member" : "team members"}</p></div>
            <button type="button" className="manager-staff-page__primary-button" onClick={openCreateForm}><span aria-hidden="true">＋</span> Add Staff</button>
          </section>

          {loadError && <div className="manager-staff-page__alert" role="alert">{loadError}</div>}

          <section className="manager-staff-page__directory" aria-label="Staff and roles">
            <div className="manager-staff-page__tabs" role="tablist" aria-label="Staff and roles views">
              <button type="button" role="tab" aria-selected={activeTab === "staff"} className={activeTab === "staff" ? "is-active" : ""} onClick={() => selectTab("staff")}>Staff Members <span>{staff.length}</span></button>
              <button type="button" role="tab" aria-selected={activeTab === "roles"} className={activeTab === "roles" ? "is-active" : ""} onClick={() => selectTab("roles")}>Roles <span>{roles.length}</span></button>
            </div>

            {activeTab === "staff" ? <>
              <div className="manager-staff-page__toolbar">
                <label className="manager-staff-page__search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff or role…" aria-label="Search staff or role" /></label>
                <span className="manager-staff-page__result-count">{filteredStaff.length} {filteredStaff.length === 1 ? "member" : "members"}</span>
              </div>
              {loading ? <div className="manager-staff-page__empty">Loading staff…</div> : filteredStaff.length ? (
                <div className="manager-staff-page__cards">
                  {filteredStaff.map((member) => {
                    const assignedTasks = taskByStaffId.get(String(member.id)) || [];
                    const nameParts = formatDisplayValue(member.username, "?").split(/[\s._-]+/).filter(Boolean);
                    const initials = (nameParts.length > 1 ? nameParts.slice(0, 2).map((part) => part.charAt(0)).join("") : (nameParts[0] || "?").slice(0, 2)).toLocaleUpperCase();
                    return (
                      <article className="manager-staff-page__member-card" key={member.id}>
                        <div className="manager-staff-page__card-main">
                          <button type="button" className="manager-staff-page__profile-link" onClick={() => { setSelectedStaff(member); setProfilePhotoError(""); }} aria-label={`View ${formatDisplayValue(member.username, "staff member")} profile`}>
                            <span className="manager-staff-page__avatar-wrap">
                              {profilePhotos[member.id]
                                ? <img className="manager-staff-page__member-avatar manager-staff-page__member-avatar--photo" src={profilePhotos[member.id]} alt="" />
                                : <span className="manager-staff-page__member-avatar" aria-hidden="true">{initials || "?"}</span>}
                              <i className={`manager-staff-page__presence${member.is_active ? " is-active" : " is-inactive"}`} aria-label={member.is_active ? "Active" : "Inactive"} />
                            </span>
                            <span className="manager-staff-page__member-info">
                              <strong title={formatDisplayValue(member.username, "Unnamed staff")}>{formatDisplayValue(member.username, "Unnamed staff")}</strong>
                              <span className="manager-staff-page__role-badge">{formatDisplayValue(member.role_name, "Role not assigned")}</span>
                            </span>
                          </button>
                          <div className="manager-staff-page__card-task-count"><strong>{assignedTasks.length}</strong><span>{assignedTasks.length === 1 ? "task" : "tasks"}</span></div>
                        </div>
                        {assignedTasks.length > 0 ? <div className="manager-staff-page__task-details" aria-label="Assigned task details">{assignedTasks.slice(0, 2).map((task) => <span key={task.id} title={`${task.product_name || "Item"} · ${task.workflow_step_name || "Step"} · ${formatDisplayValue(task.status)}`}><strong>{formatDisplayValue(task.product_name, "Item")}</strong><small>{formatDisplayValue(task.workflow_step_name, "Step")} · <em className={`manager-staff-page__task-status manager-staff-page__task-status--${String(task.status || "unknown").toLocaleLowerCase().replace(/[^a-z0-9_-]/g, "")}`}>{formatDisplayValue(task.status)}</em></small></span>)}</div> : <div className="manager-staff-page__task-empty">{tasksAvailable === false ? "Task details unavailable" : tasksAvailable === null ? "Loading task details…" : "No assigned tasks"}</div>}
                        <div className="manager-staff-page__card-footer">
                          <span className="manager-staff-page__member-email" title={member.email || "No email provided"}>{member.email || "—"}</span>
                          <span className={`manager-staff-page__status${member.is_active ? " is-active" : " is-inactive"}`}><i aria-hidden="true" />{member.is_active ? "Active" : "Inactive"}</span>
                          <button type="button" className="manager-staff-page__edit-button" onClick={() => openEditForm(member)}>Edit role</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="manager-staff-page__empty"><strong>{staff.length ? "No staff match your search." : "No staff members are listed."}</strong><span>{staff.length ? "Try another name or role." : "Add staff to see them in this directory."}</span></div>}
            </> : (
              <div className="manager-staff-page__roles-panel">
                <div className="manager-staff-page__roles-toolbar">
                  <div><strong>Available roles</strong><span>Create a role to make it available for staff assignment.</span></div>
                  <button type="button" className="manager-staff-page__primary-button" onClick={() => { setNewRoleName(""); setRoleFormError(""); setRoleFormOpen(true); }}><span aria-hidden="true">＋</span> Add Role</button>
                </div>
                <div className="manager-staff-page__roles-list">
                  {roles.length ? roles.map((item) => {
                    const members = staff.filter((member) => member.role_name === item.name);
                    return <article className="manager-staff-page__role-card" key={item.id}><span className="manager-staff-page__role-mark" aria-hidden="true">{formatDisplayValue(item.name, "R").charAt(0).toLocaleUpperCase()}</span><div><strong>{formatDisplayValue(item.name)}</strong><small>{members.length} {members.length === 1 ? "assigned member" : "assigned members"}</small></div></article>;
                  }) : <div className="manager-staff-page__empty"><strong>No roles returned.</strong></div>}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {formOpen && <StaffModal
        editingStaff={editingStaff}
        roles={roles}
        newUsername={newUsername}
        newRole={newRole}
        editRole={editRole}
        createdPassword={createdPassword}
        copied={copied}
        saving={saving}
        error={formError}
        onUsernameChange={setNewUsername}
        onNewRoleChange={setNewRole}
        onEditRoleChange={setEditRole}
        onCopyPassword={copyPassword}
        onClose={resetForm}
        onCreate={createStaff}
        onUpdate={updateRole}
      />}

      {roleFormOpen && <RoleModal
        name={newRoleName}
        saving={roleSaving}
        error={roleFormError}
        onNameChange={setNewRoleName}
        onClose={() => { setRoleFormOpen(false); setRoleFormError(""); }}
        onSubmit={createRole}
      />}

      {selectedStaff && <StaffProfileModal
        member={selectedStaff}
        tasks={taskByStaffId.get(String(selectedStaff.id)) || []}
        photo={profilePhotos[selectedStaff.id]}
        photoError={profilePhotoError}
        onPhotoChange={handleProfilePhotoChange}
        onRemovePhoto={removeProfilePhoto}
        onClose={() => { setSelectedStaff(null); setProfilePhotoError(""); }}
      />}
    </div>
  );
}

function StaffModal({ editingStaff, roles, newUsername, newRole, editRole, createdPassword, copied, saving, error, onUsernameChange, onNewRoleChange, onEditRoleChange, onCopyPassword, onClose, onCreate, onUpdate }) {
  const editing = Boolean(editingStaff);
  return (
    <div className="manager-staff-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-staff-page__modal" role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
        <header className="manager-staff-page__modal-header"><div><h2 id="staff-modal-title">{editing ? "Edit Staff Role" : createdPassword ? "Staff Member Created" : "Add Staff Member"}</h2><p>{editing ? "Update this team member’s assigned role." : "Create a staff account and assign its role."}</p></div><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header>
        {createdPassword && !editing ? <div className="manager-staff-page__password-content"><div className="manager-staff-page__password-note"><strong>Temporary password</strong><code>{createdPassword}</code><button type="button" className="manager-staff-page__secondary-button" onClick={onCopyPassword}>{copied ? "Copied ✓" : "Copy password"}</button></div><p>Share this password with the staff member. It will not be shown again after you close this window.</p>{error && <p className="manager-staff-page__form-error" role="alert">{error}</p>}<footer className="manager-staff-page__modal-actions"><button type="button" className="manager-staff-page__primary-button" onClick={onClose}>Done</button></footer></div> : (
          <form onSubmit={editing ? onUpdate : onCreate}>
            <div className="manager-staff-page__form-grid">
              {editing ? <label className="manager-staff-page__field manager-staff-page__field--wide"><span>Staff member</span><input value={formatDisplayValue(editingStaff.username)} disabled /></label> : <label className="manager-staff-page__field manager-staff-page__field--wide"><span>Username <b>*</b></span><input value={newUsername} onChange={(event) => onUsernameChange(event.target.value)} autoComplete="off" required /></label>}
              <label className="manager-staff-page__field manager-staff-page__field--wide"><span>Role <b>*</b></span><select value={editing ? editRole : newRole} onChange={(event) => editing ? onEditRoleChange(event.target.value) : onNewRoleChange(event.target.value)} required><option value="">Select role</option>{roles.map((item) => <option key={item.id} value={item.id}>{formatDisplayValue(item.name)}</option>)}</select></label>
            </div>
            {error && <p className="manager-staff-page__form-error" role="alert">{error}</p>}
            <footer className="manager-staff-page__modal-actions"><button type="button" className="manager-staff-page__secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="manager-staff-page__primary-button" disabled={saving}>{saving ? "Saving…" : editing ? "Save role" : "Create Staff"}</button></footer>
          </form>
        )}
      </section>
    </div>
  );
}

function StaffProfileModal({ member, tasks, photo, photoError, onPhotoChange, onRemovePhoto, onClose }) {
  const name = formatDisplayValue(member.username, "Unnamed staff");
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join("").toLocaleUpperCase() || "?";

  return (
    <div className="manager-staff-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-staff-page__modal manager-staff-page__profile-modal" role="dialog" aria-modal="true" aria-labelledby="staff-profile-title">
        <header className="manager-staff-page__modal-header"><div><p className="manager-staff-page__profile-eyebrow">STAFF PROFILE</p><h2 id="staff-profile-title">{name}</h2><p>Profile details and assigned work</p></div><button type="button" onClick={onClose} aria-label="Close profile">×</button></header>
        <div className="manager-staff-page__profile-content">
          <div className="manager-staff-page__profile-summary">
            <div className="manager-staff-page__profile-photo-wrap">
              {photo ? <img src={photo} alt={`${name} profile`} /> : <span aria-hidden="true">{initials}</span>}
            </div>
            <div className="manager-staff-page__profile-photo-actions">
              <label className="manager-staff-page__primary-button">
                {photo ? "Change photo" : "Add profile photo"}
                <input type="file" accept="image/*" onChange={onPhotoChange} aria-label="Choose profile photo" />
              </label>
              {photo && <button type="button" className="manager-staff-page__secondary-button" onClick={onRemovePhoto}>Remove photo</button>}
              <small>Photo is saved on this browser only; it is not synced to other devices.</small>
            </div>
          </div>

          {photoError && <p className="manager-staff-page__form-error" role="alert">{photoError}</p>}

          <dl className="manager-staff-page__profile-details">
            <div><dt>Role</dt><dd>{formatDisplayValue(member.role_name, "Role not assigned")}</dd></div>
            <div><dt>Status</dt><dd><span className={`manager-staff-page__status${member.is_active ? " is-active" : " is-inactive"}`}><i aria-hidden="true" />{member.is_active ? "Active" : "Inactive"}</span></dd></div>
            <div><dt>Email</dt><dd>{member.email || "Not provided"}</dd></div>
            <div><dt>Assigned tasks</dt><dd>{tasks.length}</dd></div>
          </dl>

          <section className="manager-staff-page__profile-tasks">
            <h3>Assigned work</h3>
            {tasks.length ? <ul>{tasks.map((task) => <li key={task.id}><span><strong>{formatDisplayValue(task.product_name, "Item")}</strong><small>{formatDisplayValue(task.order_number, task.order_id ? `Order #${task.order_id}` : "Order")} · {formatDisplayValue(task.workflow_step_name, "Step")}</small></span><em className={`manager-staff-page__task-status manager-staff-page__task-status--${String(task.status || "unknown").toLocaleLowerCase().replace(/[^a-z0-9_-]/g, "")}`}>{formatDisplayValue(task.status, "Status unavailable")}</em></li>)}</ul> : <p>No assigned tasks are returned for this staff member.</p>}
          </section>
        </div>
        <footer className="manager-staff-page__modal-actions"><button type="button" className="manager-staff-page__secondary-button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}

function RoleModal({ name, saving, error, onNameChange, onClose, onSubmit }) {
  return (
    <div className="manager-staff-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-staff-page__modal" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
        <header className="manager-staff-page__modal-header"><div><h2 id="role-modal-title">Add Role</h2><p>Create a role that can be assigned to staff and workflow steps.</p></div><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header>
        <form onSubmit={onSubmit}>
          <div className="manager-staff-page__form-grid">
            <label className="manager-staff-page__field manager-staff-page__field--wide"><span>Role name <b>*</b></span><input value={name} onChange={(event) => onNameChange(event.target.value)} required autoFocus /></label>
          </div>
          {error && <p className="manager-staff-page__form-error" role="alert">{error}</p>}
          <footer className="manager-staff-page__modal-actions"><button type="button" className="manager-staff-page__secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="manager-staff-page__primary-button" disabled={saving}>{saving ? "Creating…" : "Create Role"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default StaffManager;
