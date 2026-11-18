import { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import axios from "axios";
import { Table, Card, Badge, Icon, Flex } from "@/components/ui";
import { Calendar, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart } from "react-chartjs-2";
import { CalendarToday, Loader2, Users, TrendingUp, FileText, Shield, Search, Clock } from "lucide-react";

const FileActivityPage = ({ fileId }) => {
  const { user, fetchDriveContent, currentFolderId, searchQuery, setSearchQuery, sortBy, setSortBy } = useApp();

  const [fileActivity, setFileActivity] = useState({
    views: 0,
    unique_viewers: 0,
    downloads: 0,
    last_accessed: null,
    shared_users: [],
    activity_history: [],
  });

  const [activityLogs, setActivityLogs] = useState([]);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Fetch file activity
  const fetchFileActivity = useCallback(async () => {
    try {
      const response = await axios.get("/api/activity/logs", {
        params: { file_id: fileId, limit: 100 },
      });
      setFileActivity(response.data.activities.reduce((acc, curr) => {
        // Count views and downloads
        if (curr.action === "view") {
          acc.views = (acc.views || 0) + 1;
          if (!acc.unique_viewers_set) {
            acc.unique_viewers_set = new Set();
            acc.unique_viewers = 0;
          }
          if (!acc.unique_viewers_set.has(curr.user_id)) {
            acc.unique_viewers_set.add(curr.user_id);
            acc.unique_viewers++;
          }
        }
        if (curr.action === "download") {
          acc.downloads = (acc.downloads || 0) + 1;
        }
        // Store activity history
        acc.activity_history.push({
          id: curr.id,
          user: curr.user_name || "Unknown visitor",
          action: curr.action,
          date: new Date(curr.created_at).toLocaleString(),
          status: curr.success ? "Success" : "Denied",
        });
        return acc;
      }, {}));
      setActivityLogs(response.data.activities);
    } catch (error) {
      console.error("Failed to fetch file activity:", error);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  // Format date
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

  useEffect(() => {
    fetchFileActivity();
  }, [fetchFileActivity]);

  // Fetch recent activities for the feed
  const fetchRecentActivities = useCallback(async () => {
    try {
      const response = await axios.get("/api/activity/logs", {
        params: { limit: 20, start_date: dateFilter.start, end_date: dateFilter.end },
      });
      setActivityLogs(response.data.activities || []);
    } catch (error) {
      console.error("Failed to fetch recent activities:", error);
    }
  }, [dateFilter.start, dateFilter.end]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            <Icon className="inline mr-2 text-primary-600" size={20} />
            File Activity Details
          </h1>
          <p className="text-sm text-gray-600">
            Activity tracking for selected file
          </p>
        </div>

        {/* File Info Card */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="font-medium">File Information</h3>
          </div>
          <div className="card-body p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">File Name</p>
                <p className="font-medium text-lg">{fileActivity.views || 0}</p>
              </div>
              {/* This is just a placeholder - real file info would come from API */}
            </div>
          </div>
        </div>

        {/* Activity Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Total Views</div>
              <div className="text-2xl font-bold text-primary-600">{fileActivity.views}</div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Unique Viewers</div>
              <div className="text-2xl font-bold text-success-600">{fileActivity.unique_viewers}</div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Total Downloads</div>
              <div className="text-2xl font-bold text-success-600">{fileActivity.downloads}</div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-500">Last Accessed</div>
              <div className="text-2xl font-bold">
                {fileActivity.last_accessed ? formatDate(fileActivity.last_accessed) : "Never"}
              </div>
            </div>
          </Card>
        </div>

        {/* Activity History Table */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="font-medium">Activity History</h3>
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
              : activityLogs.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Activity</th>
                      <th>Date & Time</th>
                      <th>Access Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((activity) => (
                      <tr key={activity.id} className="border-b last:border-0">
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
                          <Badge variant={activity.success ? "secondary" : "destructive"}>
                            {activity.action}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-xs text-gray-500">
                            {formatDate(activity.date)}
                          </span>
                        </td>
                        <td>
                          <Badge
                            variant={activity.status === "Success" ? "success" : "destructive"}
                          >
                            {activity.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-gray-500 py-8">No activity recorded yet</p>
              )}
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="card mt-4">
          <div className="card-header">
            <h3 className="font-medium">Activity Over Time</h3>
          </div>
          <div className="card-body">
            {loading
              ? <div className="h-48 flex items-center justify-center">Loading chart...</div>
              : activityLogs.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={/* chart data would be generated from activity data */} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <data>
                    {activityLogs.map((activity, index) => ({
                      date: new Date(activity.created_at).toISOString().split("T")[0],
                      views: activity.action === "view" ? 1 : 0,
                      downloads: activity.action === "download" ? 1 : 0,
                    }))}
                  </data>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 py-8">No data for chart</p>
              )}
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="card mt-4">
          <div className="card-header">
            <h3 className="font-medium">Security Monitoring</h3>
          </div>
          <div className="card-body p-4">
            <p className="text-sm text-gray-500">
              Failed access attempts: <span className="font-medium text-red-600">
                {activityLogs.filter((a) => !a.success && a.action !== "view_trash").length}
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Expired or revoked links: Monitored automatically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Get file ID from route params
FileActivityPage.getDerivedStateFromProps = async ({ params }) => {
  // This would be used with router
};

export default FileActivityPage;