import { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import axios from "axios";
import { Table, Card, Button, Badge, Icon, Flex } from "@/components/ui";
import { Calendar, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "react-chartjs-2";
import { CalendarToday, Loader2, Users, TrendingUp, FileText, Shield, LogOut, Search, Clock } from "lucide-react";

const AnalyticsDashboard = () => {
  const { user, fetchDriveContent, isLoading, isUploading, uploadProgress, setUploadProgress, currentFolderId, setCurrentFolderId, breadcrumbs, folders, files, isDriveLoading, searchQuery, setSearchQuery, sortBy, setSortBy } = useApp();

  const [stats, setStats] = useState({
    totalFiles: 0,
    totalViews: 0,
    totalDownloads: 0,
    uniqueVisitors: 0,
    totalShared: 0,
    failedAccess: 0,
  });

  const [activityLogs, setActivityLogs] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [fileActivity, setFileActivity] = useState({});
  const [dateFilter, setDateFilter] = useState({ start: null, end: null });
  const [selectedFile, setSelectedFile] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);

  // Fetch analytics statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get("/api/activity/stats", {
        params: { start_date: dateFilter.start, end_date: dateFilter.end },
      });
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [dateFilter.start, dateFilter.end]);

  // Fetch activity logs
  const fetchActivityLogs = useCallback(async () => {
    try {
      const response = await axios.get("/api/activity/logs", {
        params: {
          action,
          user_id,
          file_id,
          folder_id,
          start_date: dateFilter.start,
          end_date: dateFilter.end,
          page,
          limit,
        },
      });
      setActivityLogs(response.data.activities);
      setPage(response.data.pagination.page);
      setLimit(response.data.pagination.limit);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    }
  }, [page, limit, dateFilter.start, dateFilter.end]);

  // Fetch recent activities
  const fetchRecentActivities = useCallback(async () => {
    try {
      const response = await axios.get("/api/activity/logs", {
        params: {
          limit: 20,
          start_date: dateFilter.start,
          end_date: dateFilter.end,
        },
      });
      setRecentActivities(response.data.activities || []);
    } catch (error) {
      console.error("Failed to fetch recent activities:", error);
    }
  }, [dateFilter.start, dateFilter.end]);

  // Fetch file activity
  const fetchFileActivity = useCallback(async (fileId) => {
    try {
      const response = await axios.get(`/api/activity/logs`, {
        params: { file_id, limit: 50 },
      });
      setFileActivity(response.data.activities.reduce((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
      }, {}));
    } catch (error) {
      console.error("Failed to fetch file activity:", error);
    }
  }, []);

  // Format date filter
  useEffect(() => {
    // Could add date range picker logic here
  }, [dateFilter]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            <Icon className="inline mr-2 text-primary-600" size={20} />
            Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-600">
            File activity monitoring and analytics
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Total Files</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalFiles}</div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Total Views</div>
              <div className="text-2xl font-bold text-primary-600">{stats.totalViews}</div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Total Downloads</div>
              <div className="text-2xl font-bold text-success-600">{stats.totalDownloads}</div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Unique Visitors</div>
              <div className="text-2xl font-bold text-info-600">{stats.uniqueVisitors}</div>
            </div>
          </Card>
        </div>

        {/* Action Bar */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Button variant="secondary" onClick={() => setDateFilter({ start: null, end: null })}>
            <Icon className="inline mr-1" size={16} /> Reset Filters
          </Button>
          <Button variant="primary" onClick={() => fetchRecentActivities()}>
            <Icon className="inline mr-1" size={16} /> Refresh Activity
          </Button>
          <Button variant="outline" onClick={() => setSelectedFile(null)}>
            <Icon className="inline mr-1" size={16} /> Close File Details
          </Button>
        </div>

        {/* Recent Activity Feed */}
        <div className="card mb-4">
          <div className="card-header flex justify-between items-center">
            <h3 className="font-medium">Recent Activity Feed</h3>
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          <div className="card-body h-64 overflow-y-auto">
            {isDriveLoading || loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="mr-2" size={24} />
                Loading...
              </div>
            ) : recentActivities.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No activity yet. <Button variant="link" onClick={() => fetchRecentActivities()}>
                  Refresh
                </Button>
              </p>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 rounded bg-gray-50 border-l-4 border-primary-500"
                  >
                    <div className="flex items-center space-x-3">
                      <Icon
                        className="w-4 h-4"
                        size={16}
                        color={
                          activity.success
                            ? "green-600"
                            : "red-600"
                        }
                      >
                        {activity.success ? "check-circle" : "alert-circle"}
                      </Icon>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {activity.user_name || "Unknown visitor"} {activity.action === "view" ? "viewed" : activity.action}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.created_at).toLocaleString()} {activity.file_name || ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* File Analytics Section */}
        {selectedFile && (
          <div className="card mb-4">
            <div className="card-header flex justify-between items-center">
              <h3 className="font-medium">
                File Activity: {selectedFile.name || selectedFile.original_name}
              </h3>
              <Badge variant="secondary" className="text-sm">
                {fileActivity.views || 0} views
              </Badge>
            </div>
            <div className="card-body p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Views</p>
                  <p className="text-2xl font-bold">{fileActivity.views || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Unique Viewers</p>
                  <p className="text-2xl font-bold">{fileActivity.unique_viewers || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Downloads</p>
                  <p className="text-2xl font-bold text-success-600">{fileActivity.downloads || 0}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-500">Last Accessed</p>
                <p className="font-medium">{selectedFile.last_accessed || "Never"}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-500">Shared Users</p>
                <p className="font-medium text-gray-600">View share links</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Most Viewed Files Table */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="font-medium">Most Viewed Files</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => fetchRecentActivities()}
            >
              Refresh
            </Button>
          </div>
          <div className="card-body p-4">
            {loading
              ? <div className="h-48 flex items-center justify-center">Loading...</div>
              : recentActivities.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Views</th>
                        <th>Downloads</th>
                        <th>Last Accessed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivities
                        .filter((a) => a.action === "view" && a.file_id)
                        .slice(0, 10)
                        .map((activity) => {
                          const file = activity.file_ref || {};
                          return (
                            <tr key={activity.id}>
                              <td>
                                <div className="flex items-center space-x-2">
                                  {file.icon && (
                                    <Icon className="w-4 h-4" size={16}>{file.icon}</Icon>
                                  )}
                                  <span className="font-medium truncate">
                                    {file.name || "Unknown file"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <Badge variant="secondary">{activity.count || 0}</Badge>
                              </td>
                              <td>
                                <Badge variant="success">{activity.downloads || 0}</Badge>
                              </td>
                              <td>
                                <span className="text-xs text-gray-500">
                                  {new Date(activity.created_at).toLocaleDateString()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-gray-500 py-8">No data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Security Monitoring Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">Failed Access Attempts</h3>
            </div>
            <div className="card-body p-4">
              {stats.failedAccess > 0 ? (
                <div className="space-y-2">
                  {recentActivities
                    .filter((a) => !a.success && a.action !== "view_trash")
                    .slice(0, 5)
                    .map((activity) => (
                      <div key={activity.id} className="p-2 rounded bg-red-50">
                        <p className="text-sm font-medium">
                          {activity.user_name || "Unknown visitor"} - {activity.reason || "Access denied"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-green-600">No failed access attempts</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">Most Downloaded Files</h3>
            </div>
            <div className="card-body p-4">
              {loading
                ? <div className="h-48 flex items-center justify-center">Loading...</div>
                : recentActivities
                    .filter((a) => a.action === "download" && a.downloads > 0)
                    .slice(0, 5)
                    .map((activity) => (
                      <div key={activity.id} className="p-2 rounded bg-gray-50 border-t border-b">
                        <div className="flex items-center space-x-2">
                          {activity.file_ref && (
                            <Icon
                              className="w-4 h-4"
                              size={16}
                              color="primary-600"
                            >
                              {activity.file_ref.icon}
                            </Icon>
                          )}
                          <span className="font-medium truncate">
                            {activity.file_ref?.name || "Unknown file"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500">Downloads:</span>
                          <span className="font-bold text-primary-600">
                            {activity.downloads || 0}
                          </span>
                        </div>
                      </div>
                    ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;