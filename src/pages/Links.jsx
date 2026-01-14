import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ExternalLink, Link as LinkIcon, Search } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Fuse from "fuse.js";
import { TypeAnimation } from "react-type-animation";

const Links = () => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const [links, setLinks] = useState([]);
  const [collegeName, setCollegeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Gradient backgrounds for link cards
  const gradients = [
    "from-blue-500 to-purple-600",
    "from-green-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-blue-600",
    "from-yellow-500 to-orange-600",
    "from-purple-500 to-pink-600",
    "from-cyan-500 to-blue-600",
    "from-red-500 to-pink-600",
    "from-teal-500 to-green-600",
  ];

  useEffect(() => {
    fetchLinks();
  }, [userProfile]);

  const fetchLinks = async () => {
    try {
      if (!userProfile?.collegeId) {
        setLoading(false);
        return;
      }

      // Find college by collegeId
      const collegesQuery = query(
        collection(db, "colleges"),
        where("collegeId", "==", userProfile.collegeId)
      );
      const collegesSnapshot = await getDocs(collegesQuery);

      if (!collegesSnapshot.empty) {
        const collegeData = collegesSnapshot.docs[0].data();
        setCollegeName(collegeData.name);
        setLinks(collegeData.links || []);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching links:", error);
      setLoading(false);
    }
  };

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) {
      return links;
    }

    const fuse = new Fuse(links, {
      keys: ["name", "url"],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
    });

    return fuse.search(searchQuery).map((result) => result.item);
  }, [links, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen pb-8 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <div
        className={`shadow-sm border-b sticky top-0 z-10 ${
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-2">
            <LinkIcon size={28} className="text-blue-600 md:w-8 md:h-8" />
            <h1
              className={`text-2xl md:text-3xl font-bold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}
            >
              Quick Links
            </h1>
          </div>
          <p
            className={`text-sm md:text-base ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {collegeName}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder=""
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? "bg-gray-800 border-gray-700 text-white"
                : "bg-white border-gray-300 text-gray-900"
            }`}
          />
          {!searchQuery && (
            <div className="absolute left-12 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
              <TypeAnimation
                sequence={[
                  "Search links...",
                  2000,
                  "Search by name...",
                  2000,
                  "Search by URL...",
                  2000,
                ]}
                wrapper="span"
                speed={50}
                repeat={Infinity}
              />
            </div>
          )}
        </div>
      </div>

      {/* Links Grid */}
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        {!userProfile?.collegeId ? (
          <div
            className={`text-center py-12 md:py-16 rounded-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <LinkIcon size={48} className="text-gray-300 mx-auto mb-4" />
            <p
              className={`text-base md:text-lg ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              No college access. Please sign in with your institutional email.
            </p>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div
            className={`text-center py-12 md:py-16 rounded-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <LinkIcon size={48} className="text-gray-300 mx-auto mb-4" />
            <p
              className={`text-base md:text-lg ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {searchQuery
                ? "No links found"
                : "No links available for your college"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLinks.map((link, index) => {
              const gradient = gradients[index % gradients.length];
              return (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-r ${gradient} p-6 relative block`}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
                  <div className="relative flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white line-clamp-2 flex-1">
                      {link.name}
                    </h3>
                    <ExternalLink
                      size={24}
                      className="text-white/90 ml-3 flex-shrink-0"
                    />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Links;
