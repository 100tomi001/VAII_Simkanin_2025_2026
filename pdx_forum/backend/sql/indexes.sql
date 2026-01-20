-- Forum
CREATE INDEX IF NOT EXISTS idx_topics_category_id ON topics (category_id);
CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts (topic_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_topic_tags_topic_id ON topic_tags (topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_tags_tag_id ON topic_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);

-- Wiki
CREATE INDEX IF NOT EXISTS idx_wiki_articles_slug ON wiki_articles (slug);
CREATE INDEX IF NOT EXISTS idx_wiki_articles_category ON wiki_articles (category_id);
CREATE INDEX IF NOT EXISTS idx_wiki_articles_updated_at ON wiki_articles (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_history_article_id ON wiki_article_history (article_id);
CREATE INDEX IF NOT EXISTS idx_wiki_history_created_at ON wiki_article_history (created_at DESC);

-- Notifications & messages
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);

-- Follows & reactions
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_followed ON user_follows (followed_id);
CREATE INDEX IF NOT EXISTS idx_topic_follows_user ON topic_follows (user_id);
CREATE INDEX IF NOT EXISTS idx_topic_reactions_topic ON topic_reactions (topic_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions (post_id);
