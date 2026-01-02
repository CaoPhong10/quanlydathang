import { useCallback, useEffect, useState } from "react";
import {
  Layout,
  Typography,
  Row,
  Col,
  Card,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Table,
  Tag,
  Upload,
  Button,
  Space,
  Modal,
  Form,
  Statistic,
  message,
} from "antd";
import dayjs from "dayjs";
import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    if (!config.headers) {
      config.headers = {};
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function formatNumber(value) {
  if (value == null) return "";
  return Number(value).toLocaleString("vi-VN");
}

function formatCurrency(value) {
  if (value == null) return "";
  return `${formatNumber(value)} ₫`;
}

function formatDate(value) {
  if (!value) return "";
  const d = dayjs(value);
  if (!d.isValid()) return value;
  return d.format("DD/MM/YYYY");
}

function formatStatusLabel(status) {
  if (!status) return "";
  if (status === "DA_NHAN") return "Đã nhận";
  if (status === "CHUA_NHAN") return "Chưa nhận";
  if (status === "HOAN") return "Hoàn";
  return status;
}

function formatMonth(value) {
  if (!value) return "";
  const str = String(value);
  const parts = str.split("-");
  if (parts.length !== 2) return str;
  const [year, month] = parts;
  return `${month}/${year}`;
}

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

function App() {
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem("auth_token") || null
  );
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState(() => {
    const start = dayjs().startOf("month");
    const end = dayjs().endOf("month");
    return [start, end];
  });
  const [editingOrder, setEditingOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [dailyStats, setDailyStats] = useState([]);
  const [loadingDailyStats, setLoadingDailyStats] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [loadingMonthlyStats, setLoadingMonthlyStats] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeView, setActiveView] = useState("orders");
  const [loginLoading, setLoginLoading] = useState(false);

  const [form] = Form.useForm();
  const [loginForm] = Form.useForm();

  const maxDailyOrders = dailyStats.length
    ? Math.max(...dailyStats.map(item => item.total_orders || 0))
    : 0;

  const maxMonthlyRevenue = monthlyStats.length
    ? Math.max(...monthlyStats.map(item => item.total_discounted || 0))
    : 0;

  const loadSummary = useCallback(async () => {
    if (!localStorage.getItem("auth_token")) {
      return;
    }
    setLoadingSummary(true);
    try {
      const res = await api.get("/api/stats/summary");
      setSummary(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.error || "Lỗi tải thống kê đơn hàng";
      message.error(msg);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!localStorage.getItem("auth_token")) {
      return;
    }
    setLoadingOrders(true);
    try {
      const params = {};
      if (search) {
        params.q = search;
      }
      if (statusFilter && statusFilter !== "ALL") {
        params.status = statusFilter;
      }
      if (dateRange && dateRange.length === 2) {
        params.fromDate = dateRange[0].format("YYYY-MM-DD");
        params.toDate = dateRange[1].format("YYYY-MM-DD");
      }
      const res = await api.get("/api/orders", { params });
      setOrders(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.error || "Lỗi tải danh sách đơn hàng";
      message.error(msg);
    } finally {
      setLoadingOrders(false);
    }
  }, [search, statusFilter, dateRange]);

  const loadDailyStats = useCallback(async () => {
    if (!localStorage.getItem("auth_token")) {
      return;
    }
    setLoadingDailyStats(true);
    try {
      const params = {};
      if (search) {
        params.q = search;
      }
      if (statusFilter && statusFilter !== "ALL") {
        params.status = statusFilter;
      }
      if (dateRange && dateRange.length === 2) {
        params.fromDate = dateRange[0].format("YYYY-MM-DD");
        params.toDate = dateRange[1].format("YYYY-MM-DD");
      }
      const res = await api.get("/api/stats/daily", { params });
      setDailyStats(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.error || "Lỗi tải thống kê theo ngày";
      message.error(msg);
    } finally {
      setLoadingDailyStats(false);
    }
  }, [search, statusFilter, dateRange]);

  const loadMonthlyStats = useCallback(async () => {
    if (!localStorage.getItem("auth_token")) {
      return;
    }
    setLoadingMonthlyStats(true);
    try {
      const params = {};
      if (search) {
        params.q = search;
      }
      if (statusFilter && statusFilter !== "ALL") {
        params.status = statusFilter;
      }
      if (dateRange && dateRange.length === 2) {
        params.fromDate = dateRange[0].format("YYYY-MM-DD");
        params.toDate = dateRange[1].format("YYYY-MM-DD");
      }
      const res = await api.get("/api/stats/monthly", { params });
      setMonthlyStats(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.error || "Lỗi tải thống kê theo tháng";
      message.error(msg);
    } finally {
      setLoadingMonthlyStats(false);
    }
  }, [search, statusFilter, dateRange]);

  useEffect(() => {
    loadSummary();
    loadOrders();
    loadDailyStats();
    loadMonthlyStats();
  }, [loadSummary, loadOrders, loadDailyStats, loadMonthlyStats]);

  async function handleLogin() {
    try {
      setLoginLoading(true);
      const values = await loginForm.validateFields();
      const res = await api.post("/api/login", {
        username: values.username,
        password: values.password,
      });
      const token = res.data?.token;
      if (!token) {
        message.error("Đăng nhập thất bại");
        return;
      }
      localStorage.setItem("auth_token", token);
      setAuthToken(token);
      message.success("Đăng nhập thành công");
      await Promise.all([
        loadSummary(),
        loadOrders(),
        loadDailyStats(),
        loadMonthlyStats(),
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || "Đăng nhập thất bại";
      message.error(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    setAuthToken(null);
    setSummary(null);
    setOrders([]);
    setDailyStats([]);
    setMonthlyStats([]);
  }

  const handleUploadChange = async ({ file, onSuccess, onError }) => {
    if (!file) {
      message.error("Không đọc được file Excel");
      if (onError) onError(new Error("No file"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success(
        `Import xong: thêm mới ${res.data.inserted}, cập nhật ${res.data.updated}, bỏ qua ${res.data.skipped}`
      );
      await loadSummary();
      await loadOrders();
      if (onSuccess) onSuccess(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.error || "Lỗi import. Kiểm tra lại file Excel.";
      message.error(msg);
      if (onError) onError(err);
    } finally {
      setUploading(false);
    }
  };

  function handleRowClick(order) {
    const initial = {
      ...order,
      order_date: order.order_date ? dayjs(order.order_date) : null,
      received_date: order.received_date
        ? dayjs(order.received_date)
        : null,
      note: order.note || "",
    };
    setIsCreating(false);
    setEditingOrder(initial);
    form.setFieldsValue({
      product_name: initial.product_name || "",
      tracking_code: initial.tracking_code || "",
      shop_name: initial.shop_name || "",
      original_amount:
        typeof initial.original_amount === "number"
          ? initial.original_amount
          : null,
      discounted_amount:
        typeof initial.discounted_amount === "number"
          ? initial.discounted_amount
          : null,
      address_code: initial.address_code || "",
      order_date: initial.order_date,
      status: initial.status || "CHUA_NHAN",
      received_date: initial.received_date,
      note: initial.note,
    });
    setModalVisible(true);
  }

  function handleCreateOrder() {
    setIsCreating(true);
    setEditingOrder(null);
    form.resetFields();
    form.setFieldsValue({
      shop_name: "",
      status: "CHUA_NHAN",
    });
    setModalVisible(true);
  }

  function handleJsonChange(jsonString) {
    const value = jsonString || "";
    if (!value.trim()) {
      form.setFieldsValue({
        product_name: "",
        tracking_code: "",
        shop_name: "",
        address_code: "",
        original_amount: null,
        discounted_amount: null,
      });
      return;
    }
    try {
      const data = JSON.parse(value);
      const shipping = data.don_vi_van_chuyen || {};
      const receiver = data.nguoi_nhan || {};
      const shop = data.shop || {};
      const items = Array.isArray(data.san_pham) ? data.san_pham : [];
      const payment = data.thanh_toan || {};
      let productName = "";
      if (items.length > 0 && items[0] && items[0].product_name) {
        productName = items[0].product_name;
      }
      const trackingCode = shipping.tracking_code || "";
      const addressCode = receiver.address_code || "";
      const shopName = shop.ten_shop || "";
      const originalAmount =
        typeof payment.original_amount === "number"
          ? payment.original_amount
          : null;
      const discountedAmount =
        typeof payment.discounted_amount === "number"
          ? payment.discounted_amount
          : null;
      form.setFieldsValue({
        product_name: productName,
        tracking_code: trackingCode,
        shop_name: shopName,
        address_code: addressCode,
        original_amount: originalAmount,
        discounted_amount: discountedAmount,
      });
    } catch {
      message.error("JSON không hợp lệ, vui lòng kiểm tra lại chuỗi dán vào");
    }
  }

  async function handleSaveOrder() {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const payload = {
        product_name: values.product_name || null,
        tracking_code: values.tracking_code || null,
        shop_name: values.shop_name || null,
        original_amount:
          values.original_amount == null
            ? null
            : Number(values.original_amount),
        discounted_amount:
          values.discounted_amount == null
            ? null
            : Number(values.discounted_amount),
        address_code: values.address_code || null,
        order_date: values.order_date
          ? values.order_date.format("YYYY-MM-DD")
          : null,
        status: values.status,
        note: values.note || null,
        received_date: values.received_date
          ? values.received_date.format("YYYY-MM-DD")
          : null,
      };
      if (isCreating) {
        await api.post("/api/orders", payload);
        message.success("Đã thêm đơn hàng");
      } else if (editingOrder) {
        await api.put(`/api/orders/${editingOrder.id}`, payload);
        message.success("Đã lưu đơn hàng");
      }
      setModalVisible(false);
      setEditingOrder(null);
      setIsCreating(false);
      await loadSummary();
      await loadOrders();
    } catch (err) {
      const msg =
        err.response?.data?.error || "Lỗi lưu đơn hàng";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOrder() {
    if (!editingOrder) return;
    Modal.confirm({
      title: "Xóa đơn hàng",
      content: "Bạn có chắc muốn xóa đơn hàng này?",
      okText: "Xóa",
      okButtonProps: { danger: true, loading: deleting },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setDeleting(true);
          await api.delete(`/api/orders/${editingOrder.id}`);
          message.success("Đã xóa đơn hàng");
          setModalVisible(false);
          setEditingOrder(null);
          await loadSummary();
          await loadOrders();
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  if (!authToken) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Content
          style={{
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Card title="Đăng nhập hệ thống" style={{ width: 360 }}>
            <Form
              form={loginForm}
              layout="vertical"
              onFinish={handleLogin}
              initialValues={{ username: "admin", password: "admin123" }}
            >
              <Form.Item
                label="Tài khoản"
                name="username"
                rules={[{ required: true, message: "Nhập tài khoản" }]}
              >
                <Input placeholder="Nhập tài khoản" />
              </Form.Item>
              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[{ required: true, message: "Nhập mật khẩu" }]}
              >
                <Input.Password placeholder="Nhập mật khẩu" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loginLoading}
              >
                Đăng nhập
              </Button>
            </Form>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#1677ff" }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: "#fff", margin: 0 }}>
              Quản lý đơn Shopee
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                type={activeView === "orders" ? "primary" : "default"}
                onClick={() => setActiveView("orders")}
              >
                Đơn hàng
              </Button>
              <Button
                type={activeView === "stats" ? "primary" : "default"}
                onClick={() => setActiveView("stats")}
              >
                Thống kê nâng cao
              </Button>
              <Button onClick={handleLogout}>Đăng xuất</Button>
            </Space>
          </Col>
        </Row>
      </Header>
      <Content style={{ padding: 24 }}>
        {activeView === "orders" ? (
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Space
                direction="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                <Card title="Import dữ liệu từ Excel">
                  <Space>
                    <Upload
                      accept=".xlsx,.xls"
                      showUploadList={false}
                      customRequest={handleUploadChange}
                    >
                      <Button type="primary" loading={uploading}>
                        Chọn file Shopee_2025.xlsx
                      </Button>
                    </Upload>
                  </Space>
                </Card>
                <Card title="Bộ lọc">
                  <Row gutter={8}>
                    <Col xs={24} md={8}>
                      <Input
                        placeholder="Tên hàng, mã vận đơn"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Select
                        value={statusFilter}
                        onChange={value => setStatusFilter(value)}
                        style={{ width: "100%" }}
                        options={[
                          { value: "ALL", label: "Tất cả" },
                          { value: "DA_NHAN", label: "Đã nhận" },
                          { value: "CHUA_NHAN", label: "Chưa nhận" },
                          { value: "HOAN", label: "Hoàn" },
                        ]}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <RangePicker
                        style={{ width: "100%" }}
                        value={dateRange}
                        onChange={value => setDateRange(value)}
                      />
                    </Col>
                  </Row>
                </Card>
                <Card
                  title="Danh sách đơn hàng"
                  extra={
                    <Button type="primary" onClick={handleCreateOrder}>
                      Thêm đơn
                    </Button>
                  }
                >
                  <Table
                    size="small"
                    dataSource={orders}
                    rowKey="id"
                    loading={loadingOrders}
                    pagination={{ pageSize: 20 }}
                    columns={[
                      {
                        title: "#",
                        render: (_v, _r, index) => index + 1,
                        width: 60,
                      },
                      {
                        title: "Đơn hàng",
                        dataIndex: "product_name",
                      },
                      {
                        title: "Shop",
                        dataIndex: "shop_name",
                        render: (_value, record) => (
                          <Button
                            type="link"
                            onClick={event => {
                              event.stopPropagation();
                              handleRowClick(record);
                            }}
                          >
                            {record.shop_name || "Xem chi tiết"}
                          </Button>
                        ),
                      },
                      {
                        title: "Số tiền gốc",
                        dataIndex: "original_amount",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                      {
                        title: "Số tiền sau giảm",
                        dataIndex: "discounted_amount",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                      {
                        title: "Địa chỉ",
                        dataIndex: "address_code",
                      },
                      {
                        title: "Ngày đặt",
                        dataIndex: "order_date",
                        render: value => formatDate(value),
                      },
                      {
                        title: "Mã vận đơn",
                        dataIndex: "tracking_code",
                      },
                      {
                        title: "Ngày nhận",
                        dataIndex: "received_date",
                        render: value => formatDate(value),
                      },
                      {
                        title: "Trạng thái",
                        dataIndex: "status",
                        render: status => {
                          if (!status) return null;
                          let color = "default";
                          if (status === "DA_NHAN") color = "green";
                          if (status === "CHUA_NHAN") color = "gold";
                          if (status === "HOAN") color = "red";
                          return (
                            <Tag color={color}>
                              {formatStatusLabel(status)}
                            </Tag>
                          );
                        },
                      },
                    ]}
                  />
                </Card>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space
                direction="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                <Card title="Tổng quan" loading={loadingSummary}>
                  <Statistic
                    title="Tổng số đơn"
                    value={summary?.total_orders ?? 0}
                  />
                  <Statistic
                    title="Tổng tiền gốc"
                    value={summary?.total_original ?? 0}
                    formatter={value => formatCurrency(value)}
                  />
                  <Statistic
                    title="Tổng tiền sau giảm"
                    value={summary?.total_discounted ?? 0}
                    formatter={value => formatCurrency(value)}
                  />
                  <Statistic
                    title="Lợi nhuận (gốc - sau giảm)"
                    value={summary?.total_profit ?? 0}
                    formatter={value => formatCurrency(value)}
                  />
                </Card>
                <Card title="Theo trạng thái">
                  {(summary?.status_counts || []).map(item => (
                    <Space
                      key={item.status || "KHAC"}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text>{formatStatusLabel(item.status) || "Khác"}</Text>
                      <Text>{item.count}</Text>
                    </Space>
                  ))}
                </Card>
              </Space>
            </Col>
          </Row>
        ) : (
          <>
            <Row gutter={16}>
              <Col span={24}>
                <Card title="Bộ lọc thống kê">
                  <Row gutter={8}>
                    <Col xs={24} md={8}>
                      <Input
                        placeholder="Tên hàng, mã vận đơn"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Select
                        value={statusFilter}
                        onChange={value => setStatusFilter(value)}
                        style={{ width: "100%" }}
                        options={[
                          { value: "ALL", label: "Tất cả" },
                          { value: "DA_NHAN", label: "Đã nhận" },
                          { value: "CHUA_NHAN", label: "Chưa nhận" },
                          { value: "HOAN", label: "Hoàn" },
                        ]}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <RangePicker
                        style={{ width: "100%" }}
                        value={dateRange}
                        onChange={value => setDateRange(value)}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card title="Biểu đồ số đơn theo ngày">
                  {dailyStats.length === 0 ? (
                    <Text>Không có dữ liệu</Text>
                  ) : (
                    <Space
                      direction="vertical"
                      style={{ width: "100%" }}
                      size="small"
                    >
                      {dailyStats.map(item => {
                        const ratio = maxDailyOrders
                          ? (item.total_orders || 0) / maxDailyOrders
                          : 0;
                        return (
                          <div
                            key={item.order_date}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Text style={{ width: 90 }}>
                              {formatDate(item.order_date)}
                            </Text>
                            <div
                              style={{
                                flex: 1,
                                background: "#f5f5f5",
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${ratio * 100}%`,
                                  minWidth:
                                    ratio > 0 ? 6 : 0,
                                  height: 18,
                                  background: "#1677ff",
                                }}
                              />
                            </div>
                            <Text style={{ width: 40, textAlign: "right" }}>
                              {item.total_orders}
                            </Text>
                          </div>
                        );
                      })}
                    </Space>
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Biểu đồ doanh thu theo tháng">
                  {monthlyStats.length === 0 ? (
                    <Text>Không có dữ liệu</Text>
                  ) : (
                    <Space
                      direction="vertical"
                      style={{ width: "100%" }}
                      size="small"
                    >
                      {monthlyStats.map(item => {
                        const ratio = maxMonthlyRevenue
                          ? (item.total_discounted || 0) / maxMonthlyRevenue
                          : 0;
                        return (
                          <div
                            key={item.month}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Text style={{ width: 80 }}>
                              {formatMonth(item.month)}
                            </Text>
                            <div
                              style={{
                                flex: 1,
                                background: "#f5f5f5",
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${ratio * 100}%`,
                                  minWidth:
                                    ratio > 0 ? 6 : 0,
                                  height: 18,
                                  background: "#52c41a",
                                }}
                              />
                            </div>
                            <Text style={{ width: 120, textAlign: "right" }}>
                              {formatCurrency(item.total_discounted)}
                            </Text>
                          </div>
                        );
                      })}
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card title="Chi tiết thống kê theo ngày">
                  <Table
                    size="small"
                    rowKey="order_date"
                    dataSource={dailyStats}
                    loading={loadingDailyStats}
                    pagination={false}
                    columns={[
                      {
                        title: "Ngày",
                        dataIndex: "order_date",
                        render: value => formatDate(value),
                      },
                      {
                        title: "Số đơn",
                        dataIndex: "total_orders",
                        align: "right",
                      },
                      {
                        title: "Tiền gốc",
                        dataIndex: "total_original",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                      {
                        title: "Tiền sau giảm",
                        dataIndex: "total_discounted",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                      {
                        title: "Lợi nhuận",
                        dataIndex: "total_profit",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Chi tiết thống kê theo tháng">
                  <Table
                    size="small"
                    rowKey="month"
                    dataSource={monthlyStats}
                    loading={loadingMonthlyStats}
                    pagination={false}
                    columns={[
                      {
                        title: "Tháng",
                        dataIndex: "month",
                        render: value => formatMonth(value),
                      },
                      {
                        title: "Số đơn",
                        dataIndex: "total_orders",
                        align: "right",
                      },
                      {
                        title: "Tiền gốc",
                        dataIndex: "total_original",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                      {
                        title: "Tiền sau giảm",
                        dataIndex: "total_discounted",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                      {
                        title: "Lợi nhuận",
                        dataIndex: "total_profit",
                        align: "right",
                        render: value => formatCurrency(value),
                      },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}
        <Modal
          open={modalVisible}
          title={isCreating ? "Thêm đơn hàng" : "Chi tiết đơn hàng"}
          onCancel={() => {
            setModalVisible(false);
            setEditingOrder(null);
            setIsCreating(false);
          }}
          okText="Lưu"
          confirmLoading={saving}
          footer={[
            !isCreating && (
              <Button key="delete" danger onClick={handleDeleteOrder}>
                Xóa
              </Button>
            ),
            <Button
              key="cancel"
              onClick={() => {
                setModalVisible(false);
                setEditingOrder(null);
                setIsCreating(false);
              }}
            >
              Hủy
            </Button>,
            <Button
              key="save"
              type="primary"
              loading={saving}
              onClick={handleSaveOrder}
            >
              Lưu
            </Button>,
          ].filter(Boolean)}
        >
          <Form form={form} layout="vertical">
            <Form.Item label="Dán JSON đơn hàng" name="raw_json">
              <Input.TextArea
                rows={6}
                placeholder="Dán chuỗi JSON đơn hàng vào đây để tự điền form"
                onChange={e => handleJsonChange(e.target.value)}
              />
            </Form.Item>
            <Form.Item
              label="Đơn hàng"
              name="product_name"
              rules={[{ required: true, message: "Nhập tên đơn hàng" }]}
            >
              <Input placeholder="Nhập tên đơn hàng" />
            </Form.Item>
            <Form.Item label="Tên shop" name="shop_name">
              <Input placeholder="Nhập tên shop" />
            </Form.Item>
            <Form.Item
              label="Mã vận đơn"
              name="tracking_code"
              rules={[{ required: true, message: "Nhập mã vận đơn" }]}
            >
              <Input
                placeholder="Nhập mã vận đơn"
                disabled={!isCreating}
              />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="address_code">
              <Input placeholder="Mã/ghi chú địa chỉ" />
            </Form.Item>
            <Form.Item
              label="Ngày đặt"
              name="order_date"
              rules={[{ required: true, message: "Chọn ngày đặt" }]}
            >
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="Số tiền gốc" name="original_amount">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                step={1000}
                placeholder="Nhập số tiền gốc"
              />
            </Form.Item>
            <Form.Item label="Số tiền sau giảm" name="discounted_amount">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                step={1000}
                placeholder="Nhập số tiền sau giảm"
              />
            </Form.Item>
            <Form.Item
              label="Trạng thái"
              name="status"
              rules={[{ required: true, message: "Chọn trạng thái" }]}
            >
              <Select
                options={[
                  { value: "DA_NHAN", label: "Đã nhận" },
                  { value: "CHUA_NHAN", label: "Chưa nhận" },
                  { value: "HOAN", label: "Hoàn" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Ngày nhận" name="received_date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="Ghi chú" name="note">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
}

export default App;
