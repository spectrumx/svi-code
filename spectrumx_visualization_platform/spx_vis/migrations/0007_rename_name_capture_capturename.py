# Generated by Django 4.2.14 on 2025-01-13 20:08

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('spx_vis', '0006_capture_remove_file_unique_filename_for_user_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='capture',
            old_name='name',
            new_name='captureName',
        ),
    ]
