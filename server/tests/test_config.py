import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_reject_unknown_environment_variables(tmp_path):
    env_file = tmp_path / '.env'
    env_file.write_text('OLLAMA_CHAT_MODELL=typo\n', encoding='utf-8')

    with pytest.raises(ValidationError, match='ollama_chat_modell'):
        Settings(_env_file=env_file, app_data_dir=tmp_path / 'data')


def test_settings_resolves_configured_storage_paths(tmp_path):
    settings = Settings(app_data_dir=tmp_path / 'data', ollama_base_url='http://127.0.0.1:11434/')

    assert settings.database_path == (tmp_path / 'data' / 'knowledge.sqlite3').resolve()
    assert settings.chroma_path == (tmp_path / 'data' / 'chroma').resolve()
    assert settings.ollama_base_url == 'http://127.0.0.1:11434'
