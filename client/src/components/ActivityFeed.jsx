import { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import axios from "axios";
import { Table, Card, Badge, Icon, Flex } from "@/components/ui";
import { Calendar, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart } from "react-chartjs-2";
import { CalendarToday, Loader2, Users, TrendingUp, FileText, Shield, Search, Clock } from "lucide-react";

const ActivityFeed = () => {
  const { user, searchQuery, setSearchQuery, sortBy, setSortBy } = useApp();

  const [activityLogs, setActivityLogs] = useState([]);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Fetch activity logs
  const fetchActivities = useCallback(async () => {
    try {
      const response = await axios.get("/api/activity/logs", {
        params: {
          limit: limit,
          start_date: dateFilter.start,
          end_date: dateFilter.end,
        },
      });
      setActivityLogs(response.data.activities);
      setPage(response.data.pagination.page);
      setLimit(response.data.pagination.limit);
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, dateFilter.start, dateFilter.end]);

  // Format date
  const formatDate = (dateStr) =>
    `${new Date(dateStr).toLocaleDateString()} ${new Date(dateStr).toLocaleTimeString()}`;

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Handle date range change
  const handleDateChange = (dates) => {
    setDateFilter(dates);
    fetchActivities();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            <Icon className="inline mr-2 text-primary-600" size={20} />
            Recent Activity Feed
          </h1>
          <p className="text-sm text-gray-600">
            Real-time file activity monitoring
          </p>
        </div>

        {/* Date Filter */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="grid grid-cols-1 gap-2 mb-3">
              <label className="text-xs text-gray-500">Date Range</label>
              {/* Simplified - would use datepicker in production */}
              <div className="flex items-center space-x-2">
                <Icon className="w-3 h-3 text-gray-400" size={12} />
                <span className="text-sm text-gray-500">Since</span>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1"
                  onChange={(e) =>
                    handleDateChange({ start: e.target.value || null })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Icon className="w-3 h-3 text-gray-400" size={12} />
                <span className="text-sm text-gray-500">To</span>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1"
                  onChange={(e) =>
                    handleDateChange({
                      start: dateFilter.start,
                      end: e.target.value || null,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDateFilter({ start: null, end: null })}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => fetchActivities()}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Activity Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-500">Total Activities</div>
            <div className="text-2xl font-bold text-primary-600">
              {activityLogs.length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Successful</div>
            <div className="text-2xl font-bold text-green-600">
              {activityLogs.filter((a) => a.success).length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Failed</div>
            <div className="text-2xl font-bold text-red-600">
              {activityLogs.filter((a) => !a.success).length}
            </div>
          </div>
        </div>

        {/* Recent Activities Table */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="font-medium">Recent Activities</h3>
            <Button variant="link" size="sm">
              View All
            </Button>
          </div>
          <div className="card-body p-4">
            {loading
              ? <div className="h-48 flex items-center justify-center">Loading...</div>
              : activityLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No activity yet.
                  <Button variant="link" onClick={() => fetchActivities()}>
                    Refresh
                  </Button>
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((activity) => (
                      <tr key={activity.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td>
                          <div className="flex items-center space-x-2">
                            {activity.user_icon && (
                              <Icon
                                className="w-4 h-4"
                                size={16}
                                color="primary-600"
                              >
                                {activity.user_icon}
                              </Icon>
                            )}
                            <span className="font-medium truncate">
                              {activity.user_name || "Unknown visitor"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge
                            variant={
                              activity.success
                                ? "secondary"
                                : activity.action === "access_shared"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {activity.action}
                          </Badge>
                        </td>
                        <td>
                          {activity.file_name || activity.folder_name || "—"}
                        </td>
                        <td>
                          <Badge
                            variant={activity.success ? "success" : "destructive"}
                          >
                            {activity.success ? "Success" : "Denied"}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-xs text-gray-500">
                            {formatDate(activity.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">Views Over Time</h3>
            </div>
            <div className="card-body h-48">
              {loading
                ? <div className="h-48 flex items-center justify-center">Loading...</div>
                : activityLogs.length > 0 ? (
                  <ResponsiveContainer>
                    <LineChart data={{
                      labels: activityLogs.map((a) =>
                        new Date(a.created_at).toISOString().split("T")[0]
                      ),
                      datasets: [
                        {
                          label: "Views",
                          data: activityLogs.map((a) =>
                            a.action === "view" ? 1 : 0
                          ),
                          fill: true,
                          borderColor: "primary-600",
                          backgroundColor: "primary-600",
                        },
                      ],
                    }}>
                      <XAxis />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 py-8">No data available</p>
                )
              }
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">Downloads Over Time</h3>
            </div>
            <div className="card-body h-48">
              {loading
                ? <div className="h-48 flex items-center justify-center">Loading...</div>
                : activityLogs.length > 0 ? (
                  <ResponsiveContainer>
                    <LineChart data={{
                      labels: activityLogs.map((a) =>
                        new Date(a.created_at).toISOString().split("T")[0]
                      ),
                      datasets: [
                        {
                          label: "Downloads",
                          data: activityLogs.map((a) =>
                            a.action === "download" ? 1 : 0
                          ),
                          fill: true,
                          borderColor: "success-600",
                          backgroundColor: "success-600",
                        },
                      ],
                    }}>
                      <XAxis />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 py-8">No data available</p>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;