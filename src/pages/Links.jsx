import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ExternalLink, Link as LinkIcon, Search } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import Fuse from 'fuse.js';
import { TypeAnimation } from 'react-type-animation';

const Links = () => {
  const { userProfile } = useAuth();
  const [links, setLinks] = useState([]);
  const [collegeName, setCollegeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        collection(db, 'colleges'),
        where('collegeId', '==', userProfile.collegeId)
      );
      const collegesSnapshot = await getDocs(collegesQuery);

      if (!collegesSnapshot.empty) {
        const collegeData = collegesSnapshot.docs[0].data();
        setCollegeName(collegeData.name);
        setLinks(collegeData.links || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching links:', error);
      setLoading(false);
    }
  };

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) {
      return links;
    }

    const fuse = new Fuse(links, {
      keys: ['name', 'url'],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1
    });

    return fuse.search(searchQuery).map(result => result.item);
  }, [links, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-2">
            <LinkIcon size={28} className="text-blue-600 md:w-8 md:h-8" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Quick Links</h1>
          </div>
          <p className="text-sm md:text-base text-gray-600">{collegeName}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder=""
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {!searchQuery && (
            <div className="absolute left-12 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
              <TypeAnimation
                sequence={[
                  'Search links...',
                  2000,
                  'Search by name...',
                  2000,
                  'Search by URL...',
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
          <div className="text-center py-12 md:py-16 bg-white rounded-lg">
            <LinkIcon size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-base md:text-lg">
              No college access. Please sign in with your institutional email.
            </p>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="text-center py-12 md:py-16 bg-white rounded-lg">
            <LinkIcon size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-base md:text-lg">
              {searchQuery ? 'No links found' : 'No links available for your college'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                      {link.name}
                    </h3>
                    <p className="text-sm text-gray-500 break-all">{link.url}</p>
                  </div>
                  <ExternalLink size={20} className="text-gray-400 group-hover:text-blue-600 transition-colors ml-3 flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Links;
