#!/usr/bin/env python3
"""
Demonstration script for the improved memory manager.

This script shows how the memory manager now actually terminates jobs
when memory limits are exceeded, rather than just marking them as failed.
"""

import os
import sys
import threading
import time

# Add the Django project to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

import django

django.setup()

from jobs.memory_manager import memory_manager


def simulate_memory_pressure():
    """Simulate memory pressure by allocating large amounts of memory."""
    print("Simulating memory pressure...")

    # Allocate a large amount of memory to trigger the memory manager
    large_data = []
    try:
        # Allocate ~500MB of memory
        for i in range(50):
            # Each chunk is ~10MB
            chunk = bytearray(10 * 1024 * 1024)  # 10MB
            large_data.append(chunk)
            print(f"Allocated {len(large_data) * 10}MB of memory...")
            time.sleep(0.5)

    except MemoryError:
        print("MemoryError caught - system is running out of memory")
    finally:
        # Clean up
        del large_data
        print("Memory cleaned up")


def demonstrate_memory_manager():
    """Demonstrate the improved memory manager functionality."""
    print("=== Memory Manager Demonstration ===\n")

    # 1. Show initial state
    print("1. Initial state:")
    print(f"   Active jobs: {memory_manager.get_active_jobs_count()}")
    print(f"   Memory usage: {memory_manager.get_memory_usage()}")
    print()

    # 2. Register some test jobs
    print("2. Registering test jobs...")
    memory_manager.register_job(1001, estimated_memory_mb=500, task_id="task-1001")
    memory_manager.register_job(1002, estimated_memory_mb=1000, task_id="task-1002")
    memory_manager.register_job(1003, estimated_memory_mb=2000, task_id="task-1003")

    print(f"   Active jobs: {memory_manager.get_active_jobs_count()}")
    print(f"   Job details: {memory_manager.get_active_jobs_info()}")
    print()

    # 3. Start memory monitor with low threshold for testing
    print("3. Starting memory monitor with 50% threshold...")
    memory_manager.start_global_memory_monitor(memory_threshold=50.0)
    print("   Memory monitor started")
    print()

    # 4. Simulate memory pressure in a separate thread
    print("4. Simulating memory pressure...")
    memory_thread = threading.Thread(target=simulate_memory_pressure)
    memory_thread.daemon = True
    memory_thread.start()

    # 5. Monitor what happens
    print("5. Monitoring memory manager response...")
    for i in range(10):
        active_jobs = memory_manager.get_active_jobs_count()
        memory_stats = memory_manager.get_memory_usage()
        print(
            f"   Step {i+1}: {active_jobs} active jobs, {memory_stats['percent']:.1f}% memory usage"
        )
        time.sleep(1)

        # Stop if all jobs are terminated
        if active_jobs == 0:
            print("   All jobs have been terminated!")
            break

    # 6. Clean up
    print("\n6. Cleaning up...")
    memory_manager.stop_global_memory_monitor()
    print("   Memory monitor stopped")

    # 7. Final state
    print("\n7. Final state:")
    print(f"   Active jobs: {memory_manager.get_active_jobs_count()}")
    print(f"   Memory usage: {memory_manager.get_memory_usage()}")


def demonstrate_manual_termination():
    """Demonstrate manual job termination."""
    print("\n=== Manual Job Termination Demonstration ===\n")

    # Register a test job
    print("1. Registering test job...")
    memory_manager.register_job(2001, estimated_memory_mb=800, task_id="task-2001")
    print(f"   Active jobs: {memory_manager.get_active_jobs_count()}")

    # Wait a moment
    time.sleep(1)

    # Manually terminate the job
    print("\n2. Manually terminating job...")
    success = memory_manager.terminate_job(2001, reason="demonstration")
    print(f"   Termination successful: {success}")
    print(f"   Active jobs: {memory_manager.get_active_jobs_count()}")


if __name__ == "__main__":
    try:
        demonstrate_memory_manager()
        demonstrate_manual_termination()

        print("\n=== Demonstration Complete ===")
        print(
            "The memory manager now actually terminates jobs when memory limits are exceeded!"
        )
        print("Key improvements:")
        print("- Tracks Celery task IDs for precise termination")
        print("- Uses Celery's revoke() method to terminate tasks")
        print("- Graceful termination with SIGTERM, then SIGKILL if needed")
        print("- Verifies task termination by inspecting active tasks")
        print("- Provides manual termination capabilities")

    except KeyboardInterrupt:
        print("\nDemonstration interrupted by user")
    except Exception as e:
        print(f"\nError during demonstration: {e}")
        import traceback

        traceback.print_exc()
