import { useEffect, useRef, useState } from "react";
import api from "../../api/api";
import formatDisplayValue from "./formatDisplayValue";

const statusLabels = {
  pending: "Pending",
  ready: "Ready",
  in_progress: "In progress",
  completed: "Completed",
};

export default function WorkOrderDetails({ order, mode, onTaskChange, lifecycleItem, onLifecycleChange }) {
  const [actionTaskId, setActionTaskId] = useState(null);
  const [actionError, setActionError] = useState("");
  if (lifecycleItem) {
    return <LifecycleItemDetails item={lifecycleItem} mode={mode} onLifecycleChange={onLifecycleChange} />;
  }
  const products = Array.isArray(order.products) ? order.products : [];
  const itemTaskIds = new Set(
    products.flatMap((item) =>
      Array.isArray(item.tasks)
        ? item.tasks.map((task) => task.task_id)
        : []
    )
  );
  const currentTask = order.my_task;
  const visibleProducts =
    mode === "queue"
      ? products.filter((item) =>
          Array.isArray(item.tasks)
            ? item.tasks.some(
                (task) =>
                  task.assigned_to_me === true &&
                  task.status === "in_progress"
              )
            : false
        )
      : products;
  const hasUnmatchedCurrentTask =
    currentTask &&
    !itemTaskIds.has(currentTask.task_id) &&
    (mode !== "queue" ||
      (currentTask.assigned_to_me === true &&
        currentTask.status === "in_progress"));

  const handleTaskAction = async (task, orderItemId) => {
    if (!task?.task_id) return;

    const endpoint =
      task.status === "ready"
        ? `tasks/${task.task_id}/start/`
        : task.status === "in_progress" && task.assigned_to_me === true
          ? `tasks/${task.task_id}/complete/`
          : null;

    if (!endpoint) return;

    setActionTaskId(task.task_id);
    setActionError("");
    try {
      await api.post(endpoint);
      await onTaskChange?.({
        action: endpoint.endsWith("/complete/") ? "complete" : "start",
        orderItemId,
      });
    } catch (err) {
      setActionError(
        err.response?.data?.error || "Unable to update this task."
      );
    } finally {
      setActionTaskId(null);
    }
  };

  const renderTask = (task, itemLabel, orderItemId = null) => {
    const canStart = task.status === "ready";
    const canComplete =
      task.status === "in_progress" && task.assigned_to_me === true;
    const statusLabel =
      statusLabels[task.status] || formatDisplayValue(task.status, "Unavailable");

    return (
      <section className="worker-current-task" key={task.task_id}>
        <div className="worker-current-task__heading">
          <div>
            <p className="worker-detail-eyebrow">CURRENT TASK</p>
            <h5>{itemLabel || formatDisplayValue(task.step, "Workflow task")}</h5>
          </div>
          <span className={`task-status task-status--${task.status || "unknown"}`}>
            {statusLabel}
          </span>
        </div>
        <dl className="worker-current-task__facts">
          <div><dt>Workflow step</dt><dd>{formatDisplayValue(task.step)}</dd></div>
          <div><dt>Role</dt><dd>{formatDisplayValue(task.role)}</dd></div>
          <div><dt>Assigned worker</dt><dd>{formatDisplayValue(task.worker, "Unassigned")}</dd></div>
        </dl>
        {(canStart || canComplete) && (
          <button
            type="button"
            className={`worker-task-action${canComplete ? " worker-task-action--complete" : ""}`}
            disabled={actionTaskId === task.task_id}
            onClick={() => handleTaskAction(task, orderItemId)}
          >
            {actionTaskId === task.task_id
              ? "Saving…"
              : canStart
                ? "Start task"
                : "OK"}
          </button>
        )}
      </section>
    );
  };

  const selectCurrentTask = (tasks) => {
    const taskList = Array.isArray(tasks) ? tasks : [];
    return (
      taskList.find((task) => task.status === "in_progress") ||
      taskList.find((task) => task.status === "ready") ||
      null
    );
  };

  return (
    <div className="workorder-details">
      {actionError && (
        <div className="worker-action-error" role="alert">
          {actionError}
        </div>
      )}

      <section className="worker-detail-section">
        <div className="worker-detail-section__heading">
          <div>
            <p className="worker-detail-eyebrow worker-mono">ORDER {order.order_id}</p>
            <h3>{formatDisplayValue(order.company || order.customer, "Order details")}</h3>
            {order.customer && order.company && (
              <p className="worker-order-customer">{formatDisplayValue(order.customer)}</p>
            )}
          </div>
        </div>
        <div className="worker-order-facts">
          <div><span>Customer</span><strong>{formatDisplayValue(order.customer)}</strong></div>
          <div><span>Company</span><strong>{formatDisplayValue(order.company)}</strong></div>
          <div><span>Phone</span><strong>{order.phone || "—"}</strong></div>
          <div><span>Delivery date</span><strong>{order.delivery_date || "—"}</strong></div>
          <div><span>Order total</span><strong>₹ {order.grand_total ?? "—"}</strong></div>
        </div>
      </section>

      <section className="worker-detail-section">
        <div className="worker-detail-section__heading">
          <div>
            <p className="worker-detail-eyebrow">ITEM LEVEL</p>
            <h3>Products and workflow tasks</h3>
          </div>
          <span className="worker-item-count">
            {visibleProducts.length} {visibleProducts.length === 1 ? "item" : "items"}
          </span>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="worker-detail-empty">
            {mode === "queue"
              ? "No item-associated tasks were returned for this order."
              : "No item details were returned for this order."}
          </p>
        ) : (
          <div className="worker-item-list">
            {visibleProducts.map((item) => {
              const tasks = Array.isArray(item.tasks) ? item.tasks : [];
              const availableTasks =
                mode === "queue"
                  ? tasks.filter(
                      (task) =>
                        task.assigned_to_me === true &&
                        task.status === "in_progress"
                    )
                  : tasks;
              const currentItemTask = selectCurrentTask(availableTasks);
              const isProductionComplete =
                tasks.length > 0 && tasks.every((task) => task.status === "completed");

              return (
                <article className="worker-item" key={item.id}>
                  <header className="worker-item__header">
                    <div>
                      <span className="worker-item__index">Item {item.id}</span>
                      <h4>{item.quantity} × {formatDisplayValue(item.product, "Product")}</h4>
                    </div>
                    <strong>₹ {item.total ?? "—"}</strong>
                  </header>

                  {Array.isArray(item.features) && item.features.length > 0 && (
                    <div className="worker-item__features">
                      {item.features.map((feature, index) => (
                        <span key={`${feature.name}-${index}`}>
                          <b>{formatDisplayValue(feature.name)}:</b> {formatDisplayValue(feature.value)}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(item.materials) && item.materials.length > 0 && (
                    <div className="worker-item__materials">
                      {item.materials.map((material, index) => (
                        <span key={`${material.name}-${material.variant}-${index}`}>
                          {formatDisplayValue(material.name)}{material.variant ? ` · ${formatDisplayValue(material.variant)}` : ""}
                          {material.qty !== undefined ? ` · ${material.qty} ${formatDisplayValue(material.unit, "")}` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentItemTask ? (
                    renderTask(currentItemTask, `${item.quantity} × ${formatDisplayValue(item.product, "Product")}`, item.id)
                  ) : isProductionComplete ? (
                    <div className="worker-current-task worker-current-task--complete">
                      <p className="worker-detail-eyebrow">CURRENT TASK</p>
                      <strong>Production complete</strong>
                    </div>
                  ) : (
                    <p className="worker-detail-empty">
                      {mode === "queue"
                        ? "No task for this item is currently assigned to you."
                        : "No current task was returned for this item."}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {hasUnmatchedCurrentTask && (
        <section className="worker-detail-section worker-detail-section--current">
          <div className="worker-detail-section__heading">
            <div>
              <p className="worker-detail-eyebrow">ORDER LEVEL</p>
              <h3>Current task returned by the API</h3>
            </div>
          </div>
          <p className="worker-detail-note">
            The response does not associate this task with a particular item, so it is shown separately.
          </p>
          {currentTask.status === "in_progress" || currentTask.status === "ready"
            ? renderTask(currentTask)
            : currentTask.status === "completed" && (
                <div className="worker-current-task worker-current-task--complete">
                  <p className="worker-detail-eyebrow">CURRENT TASK</p>
                  <strong>Production complete</strong>
                </div>
              )}
        </section>
      )}
    </div>
  );
}

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function responseError(error) {
  const detail = error.response?.data?.detail || error.response?.data;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    return Object.values(detail).flat().filter(Boolean).join(" ") || "Unable to save this update.";
  }
  return "Unable to save this update.";
}

function LifecycleItemDetails({ item, mode, onLifecycleChange }) {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [savedPhoto, setSavedPhoto] = useState("");
  const [showSavedPhoto, setShowSavedPhoto] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const cameraInput = useRef(null);
  const fileInput = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const handlePhotoSelection = (event) => {
    setPhoto(event.target.files?.[0] || null);
    // Allow taking or choosing the same file again after removing it.
    event.target.value = "";
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera preview needs HTTPS or localhost. You can still use the device camera picker or choose a photo.");
      cameraInput.current?.click();
      return;
    }

    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (cameraStartError) {
      setCameraError(
        cameraStartError.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, or choose a saved photo."
          : "The camera could not be opened. Check that your device has a camera, or choose a saved photo."
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const captureCameraPhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("The camera is still starting. Please try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setCameraError("The photo could not be captured. Please try again.");
      return;
    }

    setPhoto(new File([blob], `delivery-${item.order_item_id}.jpg`, { type: "image/jpeg" }));
    setPhotoError("");
    stopCamera();
  };

  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [photo]);

  useEffect(() => () => {
    if (savedPhoto) URL.revokeObjectURL(savedPhoto);
  }, [savedPhoto]);

  const uploadPhoto = async () => {
    if (!item.delivery_photo_url || photoLoading) return;
    setPhotoLoading(true);
    setPhotoError("");
    try {
      const response = await api.get(item.delivery_photo_url, { responseType: "blob" });
      const nextUrl = URL.createObjectURL(response.data);
      setSavedPhoto((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setShowSavedPhoto(true);
    } catch (loadError) {
      setPhotoError(responseError(loadError));
    } finally {
      setPhotoLoading(false);
    }
  };

  const runLifecycleAction = async (action) => {
    if (actionLoading) return;
    setActionLoading(true);
    setError("");
    try {
      const url = `worker/order-items/${item.order_item_id}/`;
      if (action === "delivery") {
        if (photo) {
          const formData = new FormData();
          formData.append("photo", photo);
          await api.post(`${url}confirm-delivery/`, formData);
        } else {
          await api.post(`${url}confirm-delivery/`, {});
        }
        await onLifecycleChange?.("Delivery confirmed.");
      } else if (action === "billing") {
        await api.post(`${url}complete-billing/`);
        await onLifecycleChange?.("Billing marked complete.");
      } else if (action === "payment") {
        await api.post(`${url}payment-received/`);
        await onLifecycleChange?.("Payment received.");
      }
    } catch (requestError) {
      setError(responseError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const isHistory = mode === "history";
  const billingComplete = Boolean(item.billing_completed_at);
  const paymentReceived = Boolean(item.payment_received_at);

  return (
    <div className="worker-lifecycle-details">
      {error && <div className="worker-action-error" role="alert">{error}</div>}
      <div className="worker-lifecycle-facts">
        <div><span>Order number</span><strong>#{item.order_id}</strong></div>
        <div><span>Customer</span><strong>{item.customer_name || "Unavailable at order time"}</strong></div>
        <div><span>Product / item</span><strong>{item.product_name || "Unavailable at order time"}</strong></div>
        <div><span>Quantity</span><strong>{item.quantity ?? "Unavailable at order time"}</strong></div>
        {item.product_description && <div className="worker-lifecycle-facts__wide"><span>Product description at order time</span><strong>{item.product_description}</strong></div>}
        {(isHistory || (item.unit_price_at_order !== null && item.unit_price_at_order !== undefined)) && <div><span>Unit price at order time</span><strong>{item.unit_price_at_order !== null && item.unit_price_at_order !== undefined ? `₹ ${item.unit_price_at_order}` : "Unavailable at order time"}</strong></div>}
        <div><span>Production completed</span><strong>{formatTimestamp(item.production_completed_at)}</strong></div>
        <div><span>Delivery method</span><strong>{formatDisplayValue(item.delivery_method, "—")}</strong></div>
        <div><span>Scheduled delivery</span><strong>{item.delivery_date || "—"}</strong></div>
        <div><span>Delivery confirmed</span><strong>{formatTimestamp(item.delivery_confirmed_at)}</strong></div>
        <div><span>Billing status</span><strong className={billingComplete ? "is-complete" : "is-pending"}>{billingComplete ? "Complete" : "Pending"}</strong></div>
        <div><span>Billing completed</span><strong>{formatTimestamp(item.billing_completed_at)}</strong></div>
        <div><span>Payment status</span><strong className={paymentReceived ? "is-complete" : "is-pending"}>{paymentReceived ? "Received" : "Pending"}</strong></div>
        <div><span>Payment confirmed</span><strong>{formatTimestamp(item.payment_received_at)}</strong></div>
      </div>

      {!isHistory && mode === "delivery" && (
        <div className="worker-lifecycle-photo-picker">
          <p className="worker-detail-eyebrow">DELIVERY PHOTO <span>OPTIONAL</span></p>
          <div className="worker-lifecycle-photo-picker__controls">
            <button type="button" className="worker-task-action worker-task-action--secondary" onClick={startCamera} disabled={cameraStarting}>{cameraStarting ? "Opening camera…" : "Take photo"}</button>
            <button type="button" className="worker-task-action worker-task-action--secondary" onClick={() => fileInput.current?.click()}>Choose photo</button>
            <input className="worker-lifecycle-file-input" ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelection} aria-label="Take a delivery photo" />
            <input className="worker-lifecycle-file-input" ref={fileInput} type="file" accept="image/*" onChange={handlePhotoSelection} aria-label="Choose a delivery photo" />
          </div>
          {cameraError && <p className="worker-lifecycle-photo-picker__error" role="alert">{cameraError}</p>}
          {photoPreview && <div className="worker-lifecycle-photo-picker__preview"><img src={photoPreview} alt="Selected delivery preview" /><button type="button" onClick={() => setPhoto(null)}>Remove photo</button></div>}
          <p className="worker-lifecycle-photo-picker__hint">You can confirm delivery without a photo.</p>
        </div>
      )}

      {cameraOpen && (
        <div className="worker-camera-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) stopCamera(); }}>
          <section className="worker-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="worker-camera-title">
            <header><div><p className="worker-detail-eyebrow">DELIVERY PHOTO</p><h3 id="worker-camera-title">Take a photo</h3></div><button type="button" onClick={stopCamera} aria-label="Close camera">×</button></header>
            <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" />
            {cameraError && <p className="worker-lifecycle-photo-picker__error" role="alert">{cameraError}</p>}
            <footer>
              <button type="button" className="worker-task-action worker-task-action--secondary" onClick={stopCamera}>Cancel</button>
              <button type="button" className="worker-task-action worker-task-action--complete" onClick={captureCameraPhoto}>Capture photo</button>
            </footer>
          </section>
        </div>
      )}

      {item.delivery_photo_url && (
        <div className="worker-lifecycle-saved-photo">
          {showSavedPhoto && savedPhoto ? <img src={savedPhoto} alt={`Order ${item.order_id}`} /> : <button type="button" className="worker-task-action worker-task-action--secondary" onClick={uploadPhoto} disabled={photoLoading}>{photoLoading ? "Loading photo…" : "View saved delivery photo"}</button>}
          {photoError && <span role="alert">{photoError}</span>}
        </div>
      )}

      {!isHistory && mode === "delivery" && <button type="button" className="worker-task-action worker-task-action--complete" disabled={actionLoading} onClick={() => runLifecycleAction("delivery")}>{actionLoading ? "Saving…" : "OK / Delivered"}</button>}
      {!isHistory && mode === "billing" && !billingComplete && <button type="button" className="worker-task-action worker-task-action--complete" disabled={actionLoading} onClick={() => runLifecycleAction("billing")}>{actionLoading ? "Saving…" : "OK / Complete Billing"}</button>}
      {!isHistory && mode === "billing" && billingComplete && !paymentReceived && <button type="button" className="worker-task-action worker-task-action--complete" disabled={actionLoading} onClick={() => runLifecycleAction("payment")}>{actionLoading ? "Saving…" : "Payment Received"}</button>}
    </div>
  );
}
