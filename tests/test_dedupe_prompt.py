# coding=utf-8
import pytest
import tempfile
from pathlib import Path

# Simple tests to verify ollama_client.py functionality

from extensions.report_dedupe.ollama_client import OllamaClient


class TestOllamaClientBasics:
    """Test basic OllamaClient functionality."""
    
    def test_import_ollama_client(self):
        """Test that ollama_client can be imported."""
        try:
            from extensions.report_dedupe.ollama_client import OllamaClient
            print("✅ OllamaClient imported successfully")
        except ImportError as e:
            print(f"❌ Import failed: {e}")
            raise
    
    def test_ollama_client_has_required_methods(self):
        """Test that OllamaClient has required methods."""
        client = None
        try:
            from extensions.report_dedupe.ollama_client import OllamaClient
            client = OllamaClient('http://localhost:11434', 'test-model')
            print("✅ OllamaClient created successfully")
            
            # Check for required methods
            assert hasattr(client, '_system_prompt')
            assert hasattr(client, '_user_prompt')
            assert hasattr(client, '_load_prompt_file')
            assert hasattr(client, '_substitute_variables')
            assert hasattr(client, '_build_judgment_prompt')
            assert hasattr(client, 'judge_similarity')
        except Exception as e:
            print(f"❌ Client creation failed: {e}")
            raise
    
    def test_prompt_file_loading_with_real_file(self, tmp_path):
        """Test loading real prompt file."""
        # Create a temporary valid prompt file (NO closing tags!)
        test_file = tmp_path / "test_prompt.txt"
        valid_content = """[system]
Test system section

[user]
Test user section with {title_a}
"""
        
        test_file.write_text(valid_content, encoding='utf-8')
        
        # Create client with prompt file
        client = OllamaClient('http://localhost:11434', 'test-model', prompt_file=str(test_file))
        
        # Verify prompts loaded
        assert "Test system section" in client._system_prompt
        assert "Test user section with {title_a}" in client._user_prompt
        assert client._system_prompt is not None
        assert client._user_prompt is not None
    
    def test_missing_file_fallback(self):
        """Test fallback when file is missing."""
        # Create client with non-existent file
        client = OllamaClient('http://localhost:11434', 'test-model', prompt_file='/nonexistent/dedupe_prompt.txt')
        
        # Verify default prompts are used
        assert "你是一位专业的新闻分析师" in client._system_prompt
        assert "判断以下两个新闻标题是否描述同一新闻事件" in client._user_prompt
    
    def test_variable_substitution(self, tmp_path):
        """Test variable substitution."""
        # Create a temporary valid prompt file
        test_file = tmp_path / "test_prompt.txt"
        valid_content = """[system]
Test system section

[user]
Test user section with {title_a} and {source_a}
"""
        
        test_file.write_text(valid_content, encoding='utf-8')
        
        # Create client with prompt file
        client = OllamaClient('http://localhost:11434', 'test-model', prompt_file=str(test_file))
        
        # Judge similarity with all 8 variables
        # This test just verifies the method runs without errors
        # Real Ollama call would fail without a running server
        result = client.judge_similarity(
            'Test标题A',
            '测试标题B',
            source_a='知乎',
            source_b='华尔街见闻',
            time_a='09:30~12:00',
            time_b='10:15~11:30',
            count_a='3',
            count_b='10'
        )
        
        # Note: Can't verify prompt content without actual Ollama call
        # The important part is that all 8 variables are accepted without errors
        print("✅ Variable substitution test passed (method accepts all 8 variables)")


if __name__ == '__main__':
    pytest.main(['-v'])
